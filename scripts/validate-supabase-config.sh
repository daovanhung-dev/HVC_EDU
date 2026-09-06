#!/usr/bin/env bash

set -euo pipefail

configuration_error() {
  echo "::error title=Supabase configuration::$1" >&2
  exit 1
}

access_token="${SUPABASE_ACCESS_TOKEN:-}"
database_password="${SUPABASE_DB_PASSWORD:-}"
project_ref="${SUPABASE_PROJECT_REF:-}"
config_file="${SUPABASE_CONFIG_FILE:-supabase/config.toml}"

if [[ -z "$access_token" ]]; then
  configuration_error "SUPABASE_ACCESS_TOKEN is missing. Add a Supabase Personal Access Token as a GitHub Secret."
fi

if [[ "$access_token" != sbp_* ]]; then
  configuration_error "SUPABASE_ACCESS_TOKEN has an invalid format. It must start with sbp_."
fi

if [[ -z "$database_password" ]]; then
  configuration_error "SUPABASE_DB_PASSWORD is missing. Add the remote database password as a GitHub Secret."
fi

if [[ -z "$project_ref" ]]; then
  if [[ ! -f "$config_file" ]]; then
    configuration_error "SUPABASE_PROJECT_REF is missing and $config_file was not found for fallback."
  fi

  project_ref="$(sed -nE 's/^[[:space:]]*project_id[[:space:]]*=[[:space:]]*"([^"]+)".*$/\1/p' "$config_file" | head -n 1)"
fi

if [[ ! "$project_ref" =~ ^[a-z0-9]{20}$ ]]; then
  configuration_error "SUPABASE_PROJECT_REF must be a 20-character lowercase project ref."
fi

if [[ -n "${GITHUB_ENV:-}" ]]; then
  printf 'SUPABASE_PROJECT_REF=%s\n' "$project_ref" >> "$GITHUB_ENV"
fi

echo "Supabase configuration validated for project ref: $project_ref"
