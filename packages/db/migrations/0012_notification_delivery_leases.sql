alter table notification_jobs
  add column locked_at timestamptz,
  add column lease_expires_at timestamptz,
  add column lease_token uuid;

delete from notification_deliveries
where id in (
  select id from (
    select id, row_number() over (partition by job_id, provider order by created_at, id) as duplicate_number
    from notification_deliveries
  ) deliveries where duplicate_number > 1
);
create unique index notification_deliveries_job_provider_uidx on notification_deliveries(job_id, provider);

drop function claim_notification_jobs(integer);
create function claim_notification_jobs(p_limit integer default 25)
returns table(job_id uuid, clinic_id uuid, recipient text, subject text, body_text text, lease_token uuid, provider_key text)
language plpgsql as $$
begin
  update notification_jobs nj set status = 'CANCELLED', lease_token = null, lease_expires_at = null
  where nj.status in ('PENDING', 'PROCESSING')
    and exists (
      select 1 from appointments a
      where a.id = (nj.payload->>'appointmentId')::uuid and a.clinic_id = nj.clinic_id
        and a.status in ('CANCELLED', 'RESCHEDULED')
    );

  update notification_jobs nj set status = 'CANCELLED', lease_token = null, lease_expires_at = null
  where nj.status in ('PENDING', 'PROCESSING')
    and not exists (
      select 1 from appointments a
      join clinic_patients cp on cp.id = a.clinic_patient_id and cp.clinic_id = a.clinic_id
      join patient_profiles pp on pp.id = cp.patient_profile_id and pp.email is not null
      where a.id = (nj.payload->>'appointmentId')::uuid and a.clinic_id = nj.clinic_id
    );

  update notification_jobs set status = 'FAILED', lease_token = null, lease_expires_at = null
  where status in ('PENDING', 'PROCESSING') and attempts >= 5
    and (status = 'PENDING' or lease_expires_at <= now());

  return query
  with due as (
    select nj.id from notification_jobs nj
    where nj.scheduled_for <= now() and nj.attempts < 5
      and (nj.status = 'PENDING' or (nj.status = 'PROCESSING' and nj.lease_expires_at <= now()))
    order by nj.scheduled_for for update skip locked limit p_limit
  ), claimed as (
    update notification_jobs nj set status = 'PROCESSING', attempts = attempts + 1,
      locked_at = now(), lease_expires_at = now() + interval '5 minutes', lease_token = gen_random_uuid()
    from due where nj.id = due.id returning nj.*
  )
  select claimed.id, claimed.clinic_id, pp.email::text,
    case claimed.event_type
      when 'APPOINTMENT_REMINDER' then 'DentivoHQ appointment reminder'
      when 'APPOINTMENT_REQUEST_RECEIVED' then 'DentivoHQ appointment request received'
      else 'DentivoHQ appointment confirmation'
    end,
    case claimed.event_type
      when 'APPOINTMENT_REMINDER' then 'This is a reminder for your upcoming dental appointment on ' || to_char(a.starts_at at time zone cl.timezone, 'FMMonth DD, YYYY at HH12:MI AM') || ' (' || cl.timezone || ').'
      when 'APPOINTMENT_REQUEST_RECEIVED' then 'We received your dental appointment request for ' || to_char(a.starts_at at time zone cl.timezone, 'FMMonth DD, YYYY at HH12:MI AM') || ' (' || cl.timezone || '). The clinic will confirm it shortly.'
      else 'Your dental appointment is confirmed for ' || to_char(a.starts_at at time zone cl.timezone, 'FMMonth DD, YYYY at HH12:MI AM') || ' (' || cl.timezone || ').'
    end,
    claimed.lease_token,
    'notification/' || claimed.id::text
  from claimed
  join appointments a on a.id = (claimed.payload->>'appointmentId')::uuid and a.clinic_id = claimed.clinic_id
  join clinic_locations cl on cl.id = a.location_id and cl.clinic_id = a.clinic_id
  join clinic_patients cp on cp.id = a.clinic_patient_id and cp.clinic_id = a.clinic_id
  join patient_profiles pp on pp.id = cp.patient_profile_id;
end;
$$;
