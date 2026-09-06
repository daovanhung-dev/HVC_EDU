#!/usr/bin/env bash
set -euo pipefail

project_ref="${1:-ytixnjosaruvpnlvkesv}"
iterations=310000

command -v supabase >/dev/null 2>&1 || { echo "supabase CLI is required" >&2; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "python3 is required to generate the password hash" >&2; exit 1; }
command -v openssl >/dev/null 2>&1 || { echo "openssl is required to generate the IP salt" >&2; exit 1; }

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "Warning: SUPABASE_ACCESS_TOKEN is not set; the CLI must already be authenticated locally." >&2
fi

root_password=''
root_password_confirmation=''
read -r -s -p "Root password: " root_password </dev/tty
printf '\n' >&2
read -r -s -p "Repeat root password: " root_password_confirmation </dev/tty
printf '\n' >&2

if [[ ${#root_password} -lt 12 || "$root_password" != "$root_password_confirmation" ]]; then
  unset root_password root_password_confirmation
  echo "Passwords must match and contain at least 12 characters." >&2
  exit 1
fi

password_hash="$({ ROOT_PASSWORD="$root_password" ROOT_ITERATIONS="$iterations" python3 - <<'PY'
import base64
import hashlib
import os

password = os.environ['ROOT_PASSWORD'].encode('utf-8')
iterations = int(os.environ['ROOT_ITERATIONS'])
salt = os.urandom(24)
digest = hashlib.pbkdf2_hmac('sha256', password, salt, iterations, dklen=32)
encode = lambda value: base64.urlsafe_b64encode(value).rstrip(b'=').decode('ascii')
print(f'pbkdf2_sha256${iterations}${encode(salt)}${encode(digest)}')
PY
})"
unset root_password root_password_confirmation

ip_hash_salt="$(openssl rand -hex 32)"

supabase secrets set \
  --project-ref "$project_ref" \
  ROOT_LOGIN_NAME=admin \
  ROOT_PASSWORD_HASH="$password_hash" \
  ROOT_IP_HASH_SALT="$ip_hash_salt" \
  ROOT_SESSION_TTL_SECONDS=1800

unset password_hash ip_hash_salt
echo "Root secrets provisioned for project $project_ref."
