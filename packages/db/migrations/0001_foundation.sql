create extension if not exists pgcrypto;
create extension if not exists citext;
create extension if not exists btree_gist;

create type platform_role as enum ('PLATFORM_ADMIN');
create type clinic_role as enum ('CLINIC_OWNER', 'CLINIC_ADMIN', 'RECEPTIONIST', 'DENTIST', 'DENTAL_ASSISTANT');
create type membership_status as enum ('INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED');
create type clinic_status as enum ('ACTIVE', 'SUSPENDED', 'CLOSED');
create type appointment_status as enum ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED');
create type subscription_status as enum ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED');

-- Better Auth core models use explicit snake_case names through packages/auth.
create table users (
  id text primary key,
  name text not null,
  email citext not null unique,
  email_verified boolean not null default false,
  image text,
  platform_role platform_role,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table auth_sessions (
  id text primary key,
  expires_at timestamptz not null,
  token text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ip_address text,
  user_agent text,
  user_id text not null references users(id) on delete cascade
);
create index auth_sessions_user_id_idx on auth_sessions(user_id);

create table auth_accounts (
  id text primary key,
  account_id text not null,
  provider_id text not null,
  user_id text not null references users(id) on delete cascade,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  password text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider_id, account_id)
);
create index auth_accounts_user_id_idx on auth_accounts(user_id);

create table auth_verifications (
  id text primary key,
  identifier text not null,
  value text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index auth_verifications_identifier_idx on auth_verifications(identifier);

create table clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status clinic_status not null default 'ACTIVE',
  created_by text not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table clinic_members (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  role clinic_role not null,
  status membership_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(clinic_id, user_id)
);
create index clinic_members_user_id_idx on clinic_members(user_id, status);

create table clinic_settings (
  clinic_id uuid primary key references clinics(id) on delete cascade,
  slot_interval_minutes integer not null default 15 check (slot_interval_minutes between 5 and 120),
  cancellation_notice_hours integer not null default 24 check (cancellation_notice_hours >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table clinic_locations (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  name text not null,
  timezone text not null,
  address_line_1 text,
  address_line_2 text,
  city text,
  region text,
  postal_code text,
  country_code char(2),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(clinic_id, id)
);

create table clinic_invitations (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  email citext not null,
  role clinic_role not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  invited_by text not null references users(id),
  created_at timestamptz not null default now()
);
create index clinic_invitations_clinic_email_idx on clinic_invitations(clinic_id, email);

create table dentists (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  user_id text references users(id),
  display_name text not null,
  license_number text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(clinic_id, id),
  unique(clinic_id, user_id)
);

create table services (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  name text not null,
  description text,
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  price_minor integer check (price_minor is null or price_minor >= 0),
  currency char(3),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(clinic_id, id)
);

create table dentist_location_assignments (
  clinic_id uuid not null references clinics(id) on delete cascade,
  dentist_id uuid not null,
  location_id uuid not null,
  created_at timestamptz not null default now(),
  primary key(dentist_id, location_id),
  foreign key(clinic_id, dentist_id) references dentists(clinic_id, id) on delete cascade,
  foreign key(clinic_id, location_id) references clinic_locations(clinic_id, id) on delete cascade
);

create table dentist_services (
  clinic_id uuid not null references clinics(id) on delete cascade,
  dentist_id uuid not null,
  service_id uuid not null,
  created_at timestamptz not null default now(),
  primary key(dentist_id, service_id),
  foreign key(clinic_id, dentist_id) references dentists(clinic_id, id) on delete cascade,
  foreign key(clinic_id, service_id) references services(clinic_id, id) on delete cascade
);

create table dentist_schedules (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  dentist_id uuid not null,
  location_id uuid not null,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  starts_at_local time not null,
  ends_at_local time not null,
  effective_from date,
  effective_to date,
  check (starts_at_local < ends_at_local),
  check (effective_to is null or effective_from is null or effective_to >= effective_from),
  foreign key(clinic_id, dentist_id) references dentists(clinic_id, id) on delete cascade,
  foreign key(clinic_id, location_id) references clinic_locations(clinic_id, id) on delete cascade
);
create index dentist_schedules_lookup_idx on dentist_schedules(clinic_id, dentist_id, location_id, day_of_week);

create table dentist_schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  dentist_id uuid not null,
  location_id uuid not null,
  exception_date date not null,
  unavailable boolean not null default true,
  starts_at_local time,
  ends_at_local time,
  reason text,
  check (unavailable or (starts_at_local is not null and ends_at_local is not null and starts_at_local < ends_at_local)),
  foreign key(clinic_id, dentist_id) references dentists(clinic_id, id) on delete cascade,
  foreign key(clinic_id, location_id) references clinic_locations(clinic_id, id) on delete cascade
);

create table dentist_time_off (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  dentist_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  check (starts_at < ends_at),
  foreign key(clinic_id, dentist_id) references dentists(clinic_id, id) on delete cascade
);
create index dentist_time_off_lookup_idx on dentist_time_off using gist (clinic_id, dentist_id, tstzrange(starts_at, ends_at, '[)'));

create table patient_profiles (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  email citext,
  phone text,
  user_id text references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(email)
);

create table clinic_patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  patient_profile_id uuid not null references patient_profiles(id),
  external_reference text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(clinic_id, id),
  unique(clinic_id, patient_profile_id)
);

create table appointments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  location_id uuid not null,
  dentist_id uuid not null,
  clinic_patient_id uuid not null,
  service_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status appointment_status not null default 'PENDING',
  is_active boolean not null default true,
  notes text,
  created_by text references users(id),
  updated_by text references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_at < ends_at),
  check (is_active = (status not in ('CANCELLED', 'RESCHEDULED'))),
  foreign key(clinic_id, location_id) references clinic_locations(clinic_id, id),
  foreign key(clinic_id, dentist_id) references dentists(clinic_id, id),
  foreign key(clinic_id, clinic_patient_id) references clinic_patients(clinic_id, id),
  foreign key(clinic_id, service_id) references services(clinic_id, id),
  exclude using gist (
    clinic_id with =,
    dentist_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (is_active)
);
create index appointments_clinic_starts_idx on appointments(clinic_id, starts_at);

create table appointment_status_history (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  appointment_id uuid not null references appointments(id) on delete cascade,
  from_status appointment_status,
  to_status appointment_status not null,
  changed_by text references users(id),
  changed_at timestamptz not null default now()
);
create index appointment_status_history_lookup_idx on appointment_status_history(clinic_id, appointment_id, changed_at);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references clinics(id) on delete cascade,
  actor_user_id text references users(id),
  action text not null,
  resource_type text not null,
  resource_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_clinic_created_idx on audit_logs(clinic_id, created_at desc);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null unique references clinics(id) on delete cascade,
  plan text not null default 'FREE',
  status subscription_status not null default 'ACTIVE',
  provider_customer_id text,
  provider_subscription_id text,
  entitlements jsonb not null default '{}'::jsonb,
  current_period_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table notification_templates (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  event_type text not null,
  subject text not null,
  body_text text not null,
  active boolean not null default true,
  unique(clinic_id, event_type)
);

create table notification_preferences (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  user_id text references users(id),
  patient_profile_id uuid references patient_profiles(id),
  email_enabled boolean not null default true,
  unique nulls not distinct (clinic_id, user_id, patient_profile_id)
);

create table notification_jobs (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  event_type text not null,
  payload jsonb not null,
  scheduled_for timestamptz not null,
  attempts integer not null default 0,
  status text not null default 'PENDING',
  created_at timestamptz not null default now()
);
create index notification_jobs_due_idx on notification_jobs(status, scheduled_for);

create table notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  job_id uuid not null references notification_jobs(id) on delete cascade,
  provider text not null,
  provider_message_id text,
  status text not null,
  error_code text,
  created_at timestamptz not null default now()
);

create table file_objects (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  owner_type text not null,
  owner_id uuid not null,
  storage_provider text not null default 'R2',
  bucket text not null,
  object_key text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  created_by text not null references users(id),
  created_at timestamptz not null default now()
);
create index file_objects_owner_idx on file_objects(clinic_id, owner_type, owner_id);

create table webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  payload_hash text not null,
  status text not null default 'PENDING',
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique(provider, provider_event_id)
);

create function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['users','auth_sessions','auth_accounts','clinics','clinic_members','clinic_settings','clinic_locations','dentists','services','patient_profiles','clinic_patients','appointments','subscriptions']
  loop
    execute format('create trigger %I_updated_at before update on %I for each row execute function set_updated_at()', table_name, table_name);
  end loop;
end;
$$;

create function record_appointment_status() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    insert into appointment_status_history(clinic_id, appointment_id, from_status, to_status, changed_by)
    values(new.clinic_id, new.id, case when tg_op = 'INSERT' then null else old.status end, new.status, coalesce(new.updated_by, new.created_by));
  end if;
  return new;
end;
$$;

create trigger appointments_status_history
after insert or update of status on appointments
for each row execute function record_appointment_status();

create function validate_location_timezone() returns trigger language plpgsql as $$
begin
  if not exists(select 1 from pg_timezone_names where name = new.timezone) then
    raise exception 'Invalid IANA timezone' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger clinic_locations_timezone
before insert or update of timezone on clinic_locations
for each row execute function validate_location_timezone();
