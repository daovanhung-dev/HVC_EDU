#!/usr/bin/env bash
set -euo pipefail

project_ref="ytixnjosaruvpnlvkesv"
dry_run=false
if [[ "${1:-}" == "--dry-run" ]]; then
  dry_run=true
elif [[ "${1:-}" != "" ]]; then
  echo "Usage: $0 [--dry-run]" >&2
  exit 2
fi

configured_ref="$(sed -n 's/^project_id = "\([^"]*\)"/\1/p' supabase/config.toml)"
remote_ref="$(supabase projects list --output json | grep -o '"id": "[^"]*"' | sed -n 's/"id": "\([^"]*\)"/\1/p' | grep -Fx "$project_ref" | head -n 1 || true)"
if [[ "$configured_ref" != "$project_ref" || "$remote_ref" != "$project_ref" ]]; then
  echo "Aborted: Supabase target is not $project_ref" >&2
  exit 1
fi

sql_file="scripts/sync-master-data.sql"
temporary_sql=""
cleanup() {
  if [[ -n "$temporary_sql" ]]; then
    rm -f -- "$temporary_sql"
  fi
}
trap cleanup EXIT

if [[ "$dry_run" == true ]]; then
  temporary_sql="$(mktemp "${TMPDIR:-/tmp}/hvc-edu-sync-dry-run.XXXXXX.sql")"
  sed 's/^commit;$/rollback;/' "$sql_file" > "$temporary_sql"
  sql_file="$temporary_sql"
  echo "Running safe master-data sync in DRY-RUN mode; all writes will be rolled back."
else
  echo "Running safe master-data sync against project $project_ref."
fi

supabase db query --linked --project-ref "$project_ref" --file "$sql_file"
