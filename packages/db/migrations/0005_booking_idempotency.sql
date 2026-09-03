create table appointment_idempotency_keys (
  clinic_id uuid not null references clinics(id) on delete cascade,
  scope text not null check (scope in ('STAFF_BOOKING', 'PUBLIC_BOOKING', 'RESCHEDULE')),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 128),
  request_fingerprint jsonb not null,
  appointment_id uuid not null references appointments(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (clinic_id, scope, idempotency_key)
);

create function appointment_booking_result(p_clinic_id uuid, p_appointment_id uuid)
returns table(
  id uuid, clinic_id uuid, location_id uuid, dentist_id uuid, clinic_patient_id uuid, service_id uuid,
  starts_at timestamptz, ends_at timestamptz, status appointment_status, patient_display_name text, service_name text
) language sql stable as $$
  select a.id, a.clinic_id, a.location_id, a.dentist_id, a.clinic_patient_id, a.service_id,
         a.starts_at, a.ends_at, a.status, pp.display_name, s.name
  from appointments a
  join clinic_patients cp on cp.id = a.clinic_patient_id and cp.clinic_id = a.clinic_id
  join patient_profiles pp on pp.id = cp.patient_profile_id
  join services s on s.id = a.service_id and s.clinic_id = a.clinic_id
  where a.id = p_appointment_id and a.clinic_id = p_clinic_id;
$$;

create function idempotent_book_clinic_appointment(
  p_actor_user_id text, p_clinic_id uuid, p_location_id uuid, p_dentist_id uuid,
  p_clinic_patient_id uuid, p_service_id uuid, p_starts_at timestamptz, p_notes text,
  p_idempotency_key text
) returns table(
  id uuid, clinic_id uuid, location_id uuid, dentist_id uuid, clinic_patient_id uuid, service_id uuid,
  starts_at timestamptz, ends_at timestamptz, status appointment_status, patient_display_name text, service_name text
) language plpgsql as $$
declare
  fingerprint jsonb := jsonb_build_object(
    'actorUserId', p_actor_user_id, 'locationId', p_location_id, 'dentistId', p_dentist_id,
    'clinicPatientId', p_clinic_patient_id, 'serviceId', p_service_id, 'startsAt', p_starts_at, 'notes', p_notes
  );
  existing appointment_idempotency_keys%rowtype;
  booked record;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_clinic_id::text || ':STAFF_BOOKING:' || p_idempotency_key, 0));
  select * into existing from appointment_idempotency_keys
  where appointment_idempotency_keys.clinic_id = p_clinic_id
    and scope = 'STAFF_BOOKING' and idempotency_key = p_idempotency_key;
  if existing.appointment_id is not null then
    if existing.request_fingerprint <> fingerprint then
      raise exception 'Idempotency key was already used for another request' using errcode = 'P0004';
    end if;
    return query select * from appointment_booking_result(p_clinic_id, existing.appointment_id);
    return;
  end if;

  select * into booked from book_clinic_appointment(
    p_actor_user_id, p_clinic_id, p_location_id, p_dentist_id, p_clinic_patient_id,
    p_service_id, p_starts_at, p_notes
  );
  insert into appointment_idempotency_keys(clinic_id, scope, idempotency_key, request_fingerprint, appointment_id)
  values(p_clinic_id, 'STAFF_BOOKING', p_idempotency_key, fingerprint, booked.id);
  return query select * from appointment_booking_result(p_clinic_id, booked.id);
end;
$$;

create function idempotent_book_public_appointment(
  p_clinic_slug text, p_location_id uuid, p_dentist_id uuid, p_service_id uuid,
  p_starts_at timestamptz, p_patient_name text, p_patient_email citext, p_patient_phone text,
  p_idempotency_key text
) returns table(
  id uuid, clinic_id uuid, location_id uuid, dentist_id uuid, clinic_patient_id uuid, service_id uuid,
  starts_at timestamptz, ends_at timestamptz, status appointment_status, patient_display_name text, service_name text
) language plpgsql as $$
declare
  target_clinic_id uuid;
  fingerprint jsonb;
  existing appointment_idempotency_keys%rowtype;
  booked record;
begin
  select clinics.id into target_clinic_id from clinics where slug = p_clinic_slug and clinics.status = 'ACTIVE';
  if target_clinic_id is null then raise exception 'Clinic not found' using errcode = 'P0002'; end if;
  fingerprint := jsonb_build_object(
    'locationId', p_location_id, 'dentistId', p_dentist_id, 'serviceId', p_service_id,
    'startsAt', p_starts_at, 'patientName', p_patient_name, 'patientEmail', p_patient_email, 'patientPhone', p_patient_phone
  );
  perform pg_advisory_xact_lock(hashtextextended(target_clinic_id::text || ':PUBLIC_BOOKING:' || p_idempotency_key, 0));
  select * into existing from appointment_idempotency_keys
  where appointment_idempotency_keys.clinic_id = target_clinic_id
    and scope = 'PUBLIC_BOOKING' and idempotency_key = p_idempotency_key;
  if existing.appointment_id is not null then
    if existing.request_fingerprint <> fingerprint then
      raise exception 'Idempotency key was already used for another request' using errcode = 'P0004';
    end if;
    return query select * from appointment_booking_result(target_clinic_id, existing.appointment_id);
    return;
  end if;

  select * into booked from book_public_appointment(
    p_clinic_slug, p_location_id, p_dentist_id, p_service_id, p_starts_at,
    p_patient_name, p_patient_email, p_patient_phone
  );
  insert into appointment_idempotency_keys(clinic_id, scope, idempotency_key, request_fingerprint, appointment_id)
  values(target_clinic_id, 'PUBLIC_BOOKING', p_idempotency_key, fingerprint, booked.id);
  return query select * from appointment_booking_result(target_clinic_id, booked.id);
end;
$$;

create function idempotent_reschedule_appointment(
  p_actor_user_id text, p_clinic_id uuid, p_appointment_id uuid, p_starts_at timestamptz,
  p_idempotency_key text
) returns table(
  id uuid, clinic_id uuid, location_id uuid, dentist_id uuid, clinic_patient_id uuid, service_id uuid,
  starts_at timestamptz, ends_at timestamptz, status appointment_status, patient_display_name text, service_name text
) language plpgsql as $$
declare
  fingerprint jsonb := jsonb_build_object(
    'actorUserId', p_actor_user_id, 'appointmentId', p_appointment_id, 'startsAt', p_starts_at
  );
  existing appointment_idempotency_keys%rowtype;
  booked record;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_clinic_id::text || ':RESCHEDULE:' || p_idempotency_key, 0));
  select * into existing from appointment_idempotency_keys
  where appointment_idempotency_keys.clinic_id = p_clinic_id
    and scope = 'RESCHEDULE' and idempotency_key = p_idempotency_key;
  if existing.appointment_id is not null then
    if existing.request_fingerprint <> fingerprint then
      raise exception 'Idempotency key was already used for another request' using errcode = 'P0004';
    end if;
    return query select * from appointment_booking_result(p_clinic_id, existing.appointment_id);
    return;
  end if;

  select * into booked from reschedule_appointment(p_actor_user_id, p_clinic_id, p_appointment_id, p_starts_at);
  if booked.id is null then return; end if;
  insert into appointment_idempotency_keys(clinic_id, scope, idempotency_key, request_fingerprint, appointment_id)
  values(p_clinic_id, 'RESCHEDULE', p_idempotency_key, fingerprint, booked.id);
  return query select * from appointment_booking_result(p_clinic_id, booked.id);
end;
$$;

-- Replace the original workflow function with qualified location columns. Its
-- table-shaped return names otherwise shadow unqualified PL/pgSQL references.
create or replace function reschedule_appointment(
  p_actor_user_id text,
  p_clinic_id uuid,
  p_appointment_id uuid,
  p_starts_at timestamptz
) returns table(
  id uuid, clinic_id uuid, location_id uuid, dentist_id uuid, clinic_patient_id uuid, service_id uuid,
  starts_at timestamptz, ends_at timestamptz, status appointment_status, patient_display_name text, service_name text
) language plpgsql as $$
declare original appointments%rowtype; replacement_id uuid;
begin
  if not exists (
    select 1 from clinic_members
    where clinic_members.clinic_id = p_clinic_id
      and user_id = p_actor_user_id
      and clinic_members.status = 'ACTIVE'
  ) then
    raise exception 'Clinic membership required' using errcode = '42501';
  end if;

  select * into original
  from appointments a
  where a.id = p_appointment_id and a.clinic_id = p_clinic_id
  for update;
  if original.id is null then return; end if;
  if original.status not in ('PENDING', 'CONFIRMED') then
    raise exception 'Appointment cannot be rescheduled' using errcode = 'P0003';
  end if;

  if not exists (
    select 1 from get_available_slots(
      p_clinic_id, original.location_id, original.dentist_id, original.service_id,
      (p_starts_at at time zone (
        select clinic_locations.timezone from clinic_locations
        where clinic_locations.id = original.location_id and clinic_locations.clinic_id = p_clinic_id
      ))::date
    ) slot where slot.starts_at = p_starts_at
  ) then
    raise exception 'Appointment slot unavailable' using errcode = '23P01';
  end if;

  update appointments
  set status = 'RESCHEDULED', is_active = false, updated_by = p_actor_user_id
  where appointments.id = original.id and appointments.clinic_id = p_clinic_id;

  insert into appointments(
    clinic_id, location_id, dentist_id, clinic_patient_id, service_id,
    starts_at, ends_at, status, notes, created_by
  )
  select p_clinic_id, original.location_id, original.dentist_id, original.clinic_patient_id, original.service_id,
         p_starts_at, p_starts_at + make_interval(mins => s.duration_minutes), 'CONFIRMED', original.notes, p_actor_user_id
  from services s where s.id = original.service_id and s.clinic_id = p_clinic_id and s.active
  returning appointments.id into replacement_id;

  insert into audit_logs(clinic_id, actor_user_id, action, resource_type, resource_id, metadata)
  values(p_clinic_id, p_actor_user_id, 'APPOINTMENT_RESCHEDULED', 'appointment', replacement_id::text,
         jsonb_build_object('previousAppointmentId', original.id));

  return query select * from appointment_booking_result(p_clinic_id, replacement_id);
end;
$$;
