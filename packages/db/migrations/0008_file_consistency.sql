create type file_object_status as enum ('PENDING_UPLOAD', 'ACTIVE', 'DELETE_PENDING');

alter table file_objects
  add column status file_object_status not null default 'ACTIVE',
  add column updated_at timestamptz not null default now();

create trigger file_objects_updated_at
before update on file_objects
for each row execute function set_updated_at();

create index file_objects_reconciliation_idx on file_objects(status, updated_at);
