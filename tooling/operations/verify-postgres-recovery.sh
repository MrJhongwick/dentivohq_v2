#!/usr/bin/env bash
set -euo pipefail

backup_file="$(mktemp)"
restore_database="dentivohq_restore"
cleanup() {
  docker compose exec -T postgres dropdb --if-exists --force -U dentivohq "$restore_database" >/dev/null 2>&1 || true
  rm -f "$backup_file"
}
trap cleanup EXIT

source_migrations="$(docker compose exec -T postgres psql -U dentivohq -d dentivohq -Atc 'select count(*) from schema_migrations')"
source_clinics="$(docker compose exec -T postgres psql -U dentivohq -d dentivohq -Atc 'select count(*) from clinics')"
docker compose exec -T postgres pg_dump -U dentivohq -d dentivohq --format=custom > "$backup_file"
docker compose exec -T postgres createdb -U dentivohq "$restore_database"
docker compose exec -T postgres pg_restore -U dentivohq -d "$restore_database" --exit-on-error < "$backup_file"
restored_migrations="$(docker compose exec -T postgres psql -U dentivohq -d "$restore_database" -Atc 'select count(*) from schema_migrations')"
restored_clinics="$(docker compose exec -T postgres psql -U dentivohq -d "$restore_database" -Atc 'select count(*) from clinics')"

test "$source_migrations" = "$restored_migrations"
test "$source_clinics" = "$restored_clinics"
printf '{"event":"postgres.recovery.completed","migrations":%s,"clinics":%s}\n' "$restored_migrations" "$restored_clinics"
