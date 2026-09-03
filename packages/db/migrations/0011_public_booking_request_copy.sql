create or replace function enqueue_appointment_notifications() returns trigger language plpgsql as $$
begin
  insert into notification_jobs(clinic_id, event_type, payload, scheduled_for)
  values(
    new.clinic_id,
    case when new.created_by is null and new.status = 'PENDING' then 'APPOINTMENT_REQUEST_RECEIVED' else 'APPOINTMENT_CONFIRMATION' end,
    jsonb_build_object('appointmentId', new.id),
    now()
  );
  if new.status = 'CONFIRMED' and new.starts_at - interval '24 hours' > now() then
    insert into notification_jobs(clinic_id, event_type, payload, scheduled_for)
    values(new.clinic_id, 'APPOINTMENT_REMINDER', jsonb_build_object('appointmentId', new.id), new.starts_at - interval '24 hours');
  end if;
  return new;
end;
$$;

create or replace function claim_notification_jobs(p_limit integer default 25)
returns table(job_id uuid, clinic_id uuid, recipient text, subject text, body_text text)
language plpgsql as $$
begin
  update notification_jobs nj set status = 'CANCELLED'
  where nj.status = 'PENDING' and nj.scheduled_for <= now()
    and not exists (
      select 1 from appointments a
      join clinic_patients cp on cp.id = a.clinic_patient_id and cp.clinic_id = a.clinic_id
      join patient_profiles pp on pp.id = cp.patient_profile_id
      where a.id = (nj.payload->>'appointmentId')::uuid and a.clinic_id = nj.clinic_id
        and a.status not in ('CANCELLED', 'RESCHEDULED') and pp.email is not null
    );
  return query
  with due as (
    select nj.id from notification_jobs nj
    where nj.status = 'PENDING' and nj.scheduled_for <= now() and nj.attempts < 5
    order by nj.scheduled_for for update skip locked limit p_limit
  ), claimed as (
    update notification_jobs nj set status = 'PROCESSING', attempts = attempts + 1
    from due where nj.id = due.id returning nj.*
  )
  select claimed.id, claimed.clinic_id, pp.email::text,
    case claimed.event_type
      when 'APPOINTMENT_REMINDER' then 'DentivoHQ appointment reminder'
      when 'APPOINTMENT_REQUEST_RECEIVED' then 'DentivoHQ appointment request received'
      else 'DentivoHQ appointment confirmation'
    end,
    case claimed.event_type
      when 'APPOINTMENT_REMINDER' then 'This is a reminder for your upcoming dental appointment at ' || to_char(a.starts_at, 'YYYY-MM-DD HH24:MI TZ') || '.'
      when 'APPOINTMENT_REQUEST_RECEIVED' then 'We received your dental appointment request for ' || to_char(a.starts_at, 'YYYY-MM-DD HH24:MI TZ') || '. The clinic will confirm it shortly.'
      else 'Your dental appointment is confirmed for ' || to_char(a.starts_at, 'YYYY-MM-DD HH24:MI TZ') || '.'
    end
  from claimed
  join appointments a on a.id = (claimed.payload->>'appointmentId')::uuid and a.clinic_id = claimed.clinic_id
  join clinic_patients cp on cp.id = a.clinic_patient_id and cp.clinic_id = a.clinic_id
  join patient_profiles pp on pp.id = cp.patient_profile_id;
end;
$$;
