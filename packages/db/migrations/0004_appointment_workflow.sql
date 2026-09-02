create or replace function change_appointment_status(
  p_actor_user_id text,
  p_clinic_id uuid,
  p_appointment_id uuid,
  p_status appointment_status
) returns table(
  id uuid, clinic_id uuid, location_id uuid, dentist_id uuid, clinic_patient_id uuid, service_id uuid,
  starts_at timestamptz, ends_at timestamptz, status appointment_status, patient_display_name text, service_name text
) language plpgsql as $$
declare current_status appointment_status;
begin
  if not exists (
    select 1 from clinic_members
    where clinic_members.clinic_id = p_clinic_id
      and user_id = p_actor_user_id
      and clinic_members.status = 'ACTIVE'
  ) then
    raise exception 'Clinic membership required' using errcode = '42501';
  end if;

  select a.status into current_status
  from appointments a
  where a.id = p_appointment_id and a.clinic_id = p_clinic_id
  for update;
  if current_status is null then return; end if;

  if current_status <> p_status and not (
    (current_status = 'PENDING' and p_status in ('CONFIRMED', 'CANCELLED')) or
    (current_status = 'CONFIRMED' and p_status in ('CHECKED_IN', 'CANCELLED', 'NO_SHOW')) or
    (current_status = 'CHECKED_IN' and p_status in ('IN_PROGRESS', 'CANCELLED')) or
    (current_status = 'IN_PROGRESS' and p_status = 'COMPLETED')
  ) then
    raise exception 'Invalid appointment status transition' using errcode = 'P0003';
  end if;

  update appointments a
  set status = p_status,
      is_active = p_status not in ('CANCELLED', 'RESCHEDULED'),
      updated_by = p_actor_user_id
  where a.id = p_appointment_id and a.clinic_id = p_clinic_id;

  insert into audit_logs(clinic_id, actor_user_id, action, resource_type, resource_id, metadata)
  values(p_clinic_id, p_actor_user_id, 'APPOINTMENT_STATUS_CHANGED', 'appointment', p_appointment_id::text,
         jsonb_build_object('from', current_status, 'to', p_status));

  return query
    select a.id, a.clinic_id, a.location_id, a.dentist_id, a.clinic_patient_id, a.service_id,
           a.starts_at, a.ends_at, a.status, pp.display_name, s.name
    from appointments a
    join clinic_patients cp on cp.id = a.clinic_patient_id and cp.clinic_id = a.clinic_id
    join patient_profiles pp on pp.id = cp.patient_profile_id
    join services s on s.id = a.service_id and s.clinic_id = a.clinic_id
    where a.id = p_appointment_id and a.clinic_id = p_clinic_id;
end;
$$;

create function reschedule_appointment(
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
      (p_starts_at at time zone (select timezone from clinic_locations where id = original.location_id and clinic_id = p_clinic_id))::date
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

  return query
    select a.id, a.clinic_id, a.location_id, a.dentist_id, a.clinic_patient_id, a.service_id,
           a.starts_at, a.ends_at, a.status, pp.display_name, s.name
    from appointments a
    join clinic_patients cp on cp.id = a.clinic_patient_id and cp.clinic_id = a.clinic_id
    join patient_profiles pp on pp.id = cp.patient_profile_id
    join services s on s.id = a.service_id and s.clinic_id = a.clinic_id
    where a.id = replacement_id and a.clinic_id = p_clinic_id;
end;
$$;

create or replace function claim_notification_jobs(p_limit integer default 25)
returns table(job_id uuid, clinic_id uuid, recipient text, subject text, body_text text)
language plpgsql as $$
begin
  update notification_jobs nj
  set status = 'CANCELLED'
  where nj.status = 'PENDING'
    and nj.scheduled_for <= now()
    and not exists (
      select 1 from appointments a
      join clinic_patients cp on cp.id = a.clinic_patient_id and cp.clinic_id = a.clinic_id
      join patient_profiles pp on pp.id = cp.patient_profile_id
      where a.id = (nj.payload->>'appointmentId')::uuid
        and a.clinic_id = nj.clinic_id
        and a.status not in ('CANCELLED', 'RESCHEDULED')
        and pp.email is not null
    );

  return query
  with due as (
    select nj.id
    from notification_jobs nj
    where nj.status = 'PENDING' and nj.scheduled_for <= now() and nj.attempts < 5
    order by nj.scheduled_for
    for update skip locked
    limit p_limit
  ), claimed as (
    update notification_jobs nj set status = 'PROCESSING', attempts = attempts + 1
    from due where nj.id = due.id
    returning nj.*
  )
  select claimed.id, claimed.clinic_id, pp.email::text,
         case claimed.event_type when 'APPOINTMENT_REMINDER' then 'DentivoHQ appointment reminder' else 'DentivoHQ appointment confirmation' end,
         case claimed.event_type
           when 'APPOINTMENT_REMINDER' then 'This is a reminder for your upcoming dental appointment at ' || to_char(a.starts_at, 'YYYY-MM-DD HH24:MI TZ') || '.'
           else 'Your dental appointment is scheduled for ' || to_char(a.starts_at, 'YYYY-MM-DD HH24:MI TZ') || '.'
         end
  from claimed
  join appointments a on a.id = (claimed.payload->>'appointmentId')::uuid and a.clinic_id = claimed.clinic_id
  join clinic_patients cp on cp.id = a.clinic_patient_id and cp.clinic_id = a.clinic_id
  join patient_profiles pp on pp.id = cp.patient_profile_id;
end;
$$;
