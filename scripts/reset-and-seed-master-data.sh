#!/usr/bin/env bash
set -euo pipefail

project_ref="ytixnjosaruvpnlvkesv"
configured_ref="$(sed -n 's/^project_id = "\([^"]*\)"/\1/p' supabase/config.toml)"
remote_ref="$(supabase projects list --output json | grep -o '"id": "[^"]*"' | grep -o "$project_ref" | head -n 1 || true)"
if [[ "$configured_ref" != "$project_ref" || "$remote_ref" != "$project_ref" ]]; then
  echo "Aborted: Supabase target is not $project_ref" >&2
  exit 1
fi

echo "Clearing center-imports through Storage API…"
storage_listing="$(supabase storage ls -r --project-ref "$project_ref" --experimental ss:///center-imports)"
storage_paths="$(printf '%s\n' "$storage_listing" | sed -n 's/.*"paths":\[\(.*\)\],"message".*/\1/p' | tr -d '"' | tr ',' '\n')"
while IFS= read -r storage_path; do
  [[ -z "$storage_path" || "$storage_path" == */ ]] && continue
  supabase storage rm --project-ref "$project_ref" --experimental --yes "ss:///$storage_path"
done <<< "$storage_paths"
echo "Resetting and seeding public data…"
supabase db query --linked --project-ref "$project_ref" --file scripts/reset-and-seed-master-data.sql
