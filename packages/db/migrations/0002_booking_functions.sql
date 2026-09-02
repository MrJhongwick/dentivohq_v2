create function get_available_slots(
  p_clinic_id uuid,
  p_location_id uuid,
  p_dentist_id uuid,
  p_service_id uuid,
  p_date date
) returns table(starts_at timestamptz, ends_at timestamptz)
language sql stable as $$
  with settings as (
    select coalesce(cs.slot_interval_minutes, 15) as slot_minutes, cl.timezone, s.duration_minutes
    from clinic_locations cl
    join services s on s.clinic_id = cl.clinic_id and s.id = p_service_id and s.active
    left join clinic_settings cs on cs.clinic_id = cl.clinic_id
    join dentist_location_assignments dla on dla.clinic_id = cl.clinic_id and dla.location_id = cl.id and dla.dentist_id = p_dentist_id
    join dentist_services ds on ds.clinic_id = cl.clinic_id and ds.dentist_id = p_dentist_id and ds.service_id = s.id
    where cl.clinic_id = p_clinic_id and cl.id = p_location_id and cl.active
  ), windows as (
    select ds.starts_at_local, ds.ends_at_local
    from dentist_schedules ds
    where ds.clinic_id = p_clinic_id and ds.location_id = p_location_id and ds.dentist_id = p_dentist_id
      and ds.day_of_week = extract(dow from p_date)::int
      and (ds.effective_from is null or ds.effective_from <= p_date)
      and (ds.effective_to is null or ds.effective_to >= p_date)
      and not exists (
        select 1 from dentist_schedule_exceptions dse
        where dse.clinic_id = ds.clinic_id and dse.location_id = ds.location_id and dse.dentist_id = ds.dentist_id
          and dse.exception_date = p_date and dse.unavailable
      )
    union all
    select dse.starts_at_local, dse.ends_at_local
    from dentist_schedule_exceptions dse
    where dse.clinic_id = p_clinic_id and dse.location_id = p_location_id and dse.dentist_id = p_dentist_id
      and dse.exception_date = p_date and not dse.unavailable
  ), candidates as (
    select slot_start,
           slot_start + make_interval(mins => settings.duration_minutes) as slot_end
    from settings, windows,
      lateral generate_series(
        (p_date + windows.starts_at_local) at time zone settings.timezone,
        ((p_date + windows.ends_at_local) at time zone settings.timezone) - make_interval(mins => settings.duration_minutes),
        make_interval(mins => settings.slot_minutes)
      ) as generated(slot_start)
  )
  select candidates.slot_start, candidates.slot_end
  from candidates
  where candidates.slot_start > now()
    and not exists (
      select 1 from dentist_time_off dto
      where dto.clinic_id = p_clinic_id and dto.dentist_id = p_dentist_id
        and tstzrange(dto.starts_at, dto.ends_at, '[)') && tstzrange(candidates.slot_start, candidates.slot_end, '[)')
    )
    and not exists (
      select 1 from appointments a
      where a.clinic_id = p_clinic_id and a.dentist_id = p_dentist_id and a.is_active
        and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(candidates.slot_start, candidates.slot_end, '[)')
    )
  order by candidates.slot_start;
$$;

create function book_clinic_appointment(
  p_actor_user_id text,
  p_clinic_id uuid,
  p_location_id uuid,
  p_dentist_id uuid,
  p_clinic_patient_id uuid,
  p_service_id uuid,
  p_starts_at timestamptz,
  p_notes text
) returns table(
  id uuid, clinic_id uuid, location_id uuid, dentist_id uuid, clinic_patient_id uuid, service_id uuid,
  starts_at timestamptz, ends_at timestamptz, status appointment_status, patient_display_name text, service_name text
) language plpgsql as $$
declare appointment_id uuid;
begin
  if not exists(select 1 from clinic_members where clinic_members.clinic_id = p_clinic_id and user_id = p_actor_user_id and clinic_members.status = 'ACTIVE') then
    raise exception 'Clinic membership required' using errcode = '42501';
  end if;
  if not exists(select 1 from get_available_slots(p_clinic_id, p_location_id, p_dentist_id, p_service_id, (p_starts_at at time zone (select timezone from clinic_locations where clinic_locations.id = p_location_id and clinic_locations.clinic_id = p_clinic_id))::date) slot where slot.starts_at = p_starts_at) then
    raise exception 'Appointment slot unavailable' using errcode = '23P01';
  end if;
  insert into appointments(clinic_id, location_id, dentist_id, clinic_patient_id, service_id, starts_at, ends_at, notes, created_by)
  select p_clinic_id, p_location_id, p_dentist_id, p_clinic_patient_id, p_service_id, p_starts_at,
         p_starts_at + make_interval(mins => services.duration_minutes), p_notes, p_actor_user_id
  from services where services.id = p_service_id and services.clinic_id = p_clinic_id and services.active
  returning appointments.id into appointment_id;
  if appointment_id is null then raise exception 'Service not found' using errcode = 'P0002'; end if;
  insert into audit_logs(clinic_id, actor_user_id, action, resource_type, resource_id)
  values(p_clinic_id, p_actor_user_id, 'APPOINTMENT_CREATED', 'appointment', appointment_id::text);
  return query
    select a.id, a.clinic_id, a.location_id, a.dentist_id, a.clinic_patient_id, a.service_id, a.starts_at, a.ends_at, a.status,
           pp.display_name, s.name
    from appointments a join clinic_patients cp on cp.id = a.clinic_patient_id and cp.clinic_id = a.clinic_id
    join patient_profiles pp on pp.id = cp.patient_profile_id join services s on s.id = a.service_id and s.clinic_id = a.clinic_id
    where a.id = appointment_id and a.clinic_id = p_clinic_id;
end;
$$;

create function book_public_appointment(
  p_clinic_slug text,
  p_location_id uuid,
  p_dentist_id uuid,
  p_service_id uuid,
  p_starts_at timestamptz,
  p_patient_name text,
  p_patient_email citext,
  p_patient_phone text
) returns table(
  id uuid, clinic_id uuid, location_id uuid, dentist_id uuid, clinic_patient_id uuid, service_id uuid,
  starts_at timestamptz, ends_at timestamptz, status appointment_status, patient_display_name text, service_name text
) language plpgsql as $$
declare target_clinic_id uuid; profile_id uuid; clinic_patient uuid; appointment_id uuid;
begin
  select clinics.id into target_clinic_id from clinics where slug = p_clinic_slug and clinics.status = 'ACTIVE';
  if target_clinic_id is null then raise exception 'Clinic not found' using errcode = 'P0002'; end if;
  if not exists(select 1 from get_available_slots(target_clinic_id, p_location_id, p_dentist_id, p_service_id, (p_starts_at at time zone (select timezone from clinic_locations where clinic_locations.id = p_location_id and clinic_id = target_clinic_id))::date) slot where slot.starts_at = p_starts_at) then
    raise exception 'Appointment slot unavailable' using errcode = '23P01';
  end if;
  insert into patient_profiles(display_name, email, phone) values(p_patient_name, p_patient_email, p_patient_phone)
  on conflict(email) do update set display_name = excluded.display_name, phone = excluded.phone
  returning patient_profiles.id into profile_id;
  insert into clinic_patients(clinic_id, patient_profile_id) values(target_clinic_id, profile_id)
  on conflict(clinic_id, patient_profile_id) do update set active = true
  returning clinic_patients.id into clinic_patient;
  insert into appointments(clinic_id, location_id, dentist_id, clinic_patient_id, service_id, starts_at, ends_at)
  select target_clinic_id, p_location_id, p_dentist_id, clinic_patient, p_service_id, p_starts_at,
         p_starts_at + make_interval(mins => services.duration_minutes)
  from services where services.id = p_service_id and services.clinic_id = target_clinic_id and services.active
  returning appointments.id into appointment_id;
  insert into audit_logs(clinic_id, action, resource_type, resource_id)
  values(target_clinic_id, 'APPOINTMENT_CREATED', 'appointment', appointment_id::text);
  return query
    select a.id, a.clinic_id, a.location_id, a.dentist_id, a.clinic_patient_id, a.service_id, a.starts_at, a.ends_at, a.status,
           pp.display_name, s.name
    from appointments a join clinic_patients cp on cp.id = a.clinic_patient_id and cp.clinic_id = a.clinic_id
    join patient_profiles pp on pp.id = cp.patient_profile_id join services s on s.id = a.service_id and s.clinic_id = a.clinic_id
    where a.id = appointment_id;
end;
$$;

create function change_appointment_status(p_actor_user_id text, p_clinic_id uuid, p_appointment_id uuid, p_status appointment_status)
returns table(
  id uuid, clinic_id uuid, location_id uuid, dentist_id uuid, clinic_patient_id uuid, service_id uuid,
  starts_at timestamptz, ends_at timestamptz, status appointment_status, patient_display_name text, service_name text
) language plpgsql as $$
begin
  if not exists(select 1 from clinic_members where clinic_members.clinic_id = p_clinic_id and user_id = p_actor_user_id and clinic_members.status = 'ACTIVE') then
    raise exception 'Clinic membership required' using errcode = '42501';
  end if;
  update appointments a set status = p_status, is_active = p_status not in ('CANCELLED', 'RESCHEDULED'), updated_by = p_actor_user_id
  where a.id = p_appointment_id and a.clinic_id = p_clinic_id;
  if not found then return; end if;
  insert into audit_logs(clinic_id, actor_user_id, action, resource_type, resource_id, metadata)
  values(p_clinic_id, p_actor_user_id, 'APPOINTMENT_STATUS_CHANGED', 'appointment', p_appointment_id::text, jsonb_build_object('status', p_status));
  return query
    select a.id, a.clinic_id, a.location_id, a.dentist_id, a.clinic_patient_id, a.service_id, a.starts_at, a.ends_at, a.status,
           pp.display_name, s.name
    from appointments a join clinic_patients cp on cp.id = a.clinic_patient_id and cp.clinic_id = a.clinic_id
    join patient_profiles pp on pp.id = cp.patient_profile_id join services s on s.id = a.service_id and s.clinic_id = a.clinic_id
    where a.id = p_appointment_id and a.clinic_id = p_clinic_id;
end;
$$;
