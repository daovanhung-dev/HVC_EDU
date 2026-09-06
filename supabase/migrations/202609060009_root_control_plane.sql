begin;

alter table public.audit_logs
  add column if not exists actor_login text;

create table if not exists public.root_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  ip_hash text,
  user_agent text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.root_login_attempts (
  username text not null,
  ip_hash text not null,
  failure_count integer not null default 0 check (failure_count >= 0),
  window_started_at timestamptz not null default now(),
  locked_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (username, ip_hash)
);

create index if not exists root_sessions_expiry_idx
  on public.root_sessions (expires_at, revoked_at);

create index if not exists root_login_attempts_lock_idx
  on public.root_login_attempts (locked_until);

alter table public.root_sessions enable row level security;
alter table public.root_login_attempts enable row level security;

revoke all on table public.root_sessions, public.root_login_attempts from public, anon, authenticated;
grant select, insert, update, delete on table public.root_sessions, public.root_login_attempts to service_role;

create or replace function public.rpc_root_create_admin(
  p_user_id uuid,
  p_center_id uuid,
  p_full_name text,
  p_email text,
  p_actor_login text default 'admin',
  p_trace_id text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  result_row public.profiles;
begin
  if auth.role() <> 'service_role' then
    raise exception 'FORBIDDEN';
  end if;
  if p_user_id is null or p_center_id is null or nullif(trim(p_full_name), '') is null or nullif(trim(p_email), '') is null then
    raise exception 'VALIDATION_ERROR';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'ADMIN_AUTH_USER_NOT_FOUND';
  end if;
  if not exists (select 1 from public.centers where id = p_center_id and status = 'ACTIVE') then
    raise exception 'CENTER_NOT_FOUND';
  end if;
  if exists (select 1 from public.profiles where user_id = p_user_id) then
    raise exception 'ADMIN_ACCOUNT_EXISTS';
  end if;

  insert into public.profiles(user_id, center_id, full_name, role, staff_id, active)
  values (p_user_id, p_center_id, trim(p_full_name), 'ADMIN', null, true)
  returning * into result_row;

  insert into public.audit_logs(center_id, actor_user_id, actor_login, action, resource_type, resource_id, after_data, trace_id)
  values (result_row.center_id, null, coalesce(nullif(trim(p_actor_login), ''), 'admin'), 'ROOT_ADMIN_CREATED', 'profiles', result_row.user_id, to_jsonb(result_row), p_trace_id);

  return result_row;
end;
$$;

create or replace function public.rpc_root_deactivate_admin(
  p_user_id uuid,
  p_actor_login text default 'admin',
  p_trace_id text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  result_row public.profiles;
begin
  if auth.role() <> 'service_role' then
    raise exception 'FORBIDDEN';
  end if;
  if p_user_id is null then
    raise exception 'VALIDATION_ERROR';
  end if;

  update public.profiles
  set active = false
  where user_id = p_user_id and role = 'ADMIN'
  returning * into result_row;

  if result_row.user_id is null then
    raise exception 'ADMIN_NOT_FOUND';
  end if;

  insert into public.audit_logs(center_id, actor_user_id, actor_login, action, resource_type, resource_id, after_data, trace_id)
  values (result_row.center_id, null, coalesce(nullif(trim(p_actor_login), ''), 'admin'), 'ROOT_ADMIN_DEACTIVATED', 'profiles', result_row.user_id, to_jsonb(result_row), p_trace_id);

  return result_row;
end;
$$;

revoke all on function public.rpc_root_create_admin(uuid, uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.rpc_root_deactivate_admin(uuid, text, text) from public, anon, authenticated;
grant execute on function public.rpc_root_create_admin(uuid, uuid, text, text, text, text) to service_role;
grant execute on function public.rpc_root_deactivate_admin(uuid, text, text) to service_role;

commit;
