alter table patient_profiles add column clinic_id uuid references clinics(id) on delete cascade;
alter table patient_profiles drop constraint patient_profiles_email_key;

-- Existing globally shared profiles are split into tenant-owned copies before the
-- composite foreign key makes cross-clinic profile links impossible.
do $$
declare
  link record;
  copied_profile_id uuid;
begin
  for link in
    select cp.id as clinic_patient_id, cp.clinic_id, pp.display_name, pp.email, pp.phone,
           pp.user_id, pp.created_at, pp.updated_at
    from clinic_patients cp
    join patient_profiles pp on pp.id = cp.patient_profile_id
  loop
    insert into patient_profiles(clinic_id, display_name, email, phone, user_id, created_at, updated_at)
    values(link.clinic_id, link.display_name, link.email, link.phone, link.user_id, link.created_at, link.updated_at)
    returning id into copied_profile_id;
    update clinic_patients set patient_profile_id = copied_profile_id where id = link.clinic_patient_id;
  end loop;
end;
$$;

delete from patient_profiles pp
where pp.clinic_id is null
  and not exists (select 1 from clinic_patients cp where cp.patient_profile_id = pp.id);

alter table patient_profiles alter column clinic_id set not null;
alter table patient_profiles add constraint patient_profiles_clinic_id_id_key unique(clinic_id, id);
alter table patient_profiles add constraint patient_profiles_clinic_email_key unique(clinic_id, email);
alter table clinic_patients drop constraint clinic_patients_patient_profile_id_fkey;
alter table clinic_patients add constraint clinic_patients_clinic_profile_fkey
  foreign key(clinic_id, patient_profile_id) references patient_profiles(clinic_id, id);

create or replace function book_public_appointment(
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
  if not exists(select 1 from get_available_slots(target_clinic_id, p_location_id, p_dentist_id, p_service_id, (p_starts_at at time zone (select timezone from clinic_locations where clinic_locations.id = p_location_id and clinic_locations.clinic_id = target_clinic_id))::date) slot where slot.starts_at = p_starts_at) then
    raise exception 'Appointment slot unavailable' using errcode = '23P01';
  end if;

  insert into patient_profiles(clinic_id, display_name, email, phone)
  values(target_clinic_id, p_patient_name, p_patient_email, p_patient_phone)
  on conflict on constraint patient_profiles_clinic_email_key do nothing
  returning patient_profiles.id into profile_id;
  if profile_id is null then
    select patient_profiles.id into profile_id
    from patient_profiles
    where patient_profiles.clinic_id = target_clinic_id and patient_profiles.email = p_patient_email;
  end if;

  insert into clinic_patients(clinic_id, patient_profile_id) values(target_clinic_id, profile_id)
  on conflict on constraint clinic_patients_clinic_id_patient_profile_id_key do update set active = true
  returning clinic_patients.id into clinic_patient;
  insert into appointments(clinic_id, location_id, dentist_id, clinic_patient_id, service_id, starts_at, ends_at)
  select target_clinic_id, p_location_id, p_dentist_id, clinic_patient, p_service_id, p_starts_at,
         p_starts_at + make_interval(mins => services.duration_minutes)
  from services where services.id = p_service_id and services.clinic_id = target_clinic_id and services.active
  returning appointments.id into appointment_id;
  insert into audit_logs(clinic_id, action, resource_type, resource_id)
  values(target_clinic_id, 'APPOINTMENT_CREATED', 'appointment', appointment_id::text);
  return query select * from appointment_booking_result(target_clinic_id, appointment_id);
end;
$$;
