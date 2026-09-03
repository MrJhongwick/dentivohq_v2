create or replace function get_available_slots(
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
    join dentists d on d.clinic_id = cl.clinic_id and d.id = p_dentist_id and d.active
    left join clinic_settings cs on cs.clinic_id = cl.clinic_id
    join dentist_location_assignments dla on dla.clinic_id = cl.clinic_id and dla.location_id = cl.id and dla.dentist_id = d.id
    join dentist_services ds on ds.clinic_id = cl.clinic_id and ds.dentist_id = d.id and ds.service_id = s.id
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
          and (dse.starts_at_local is null or dse.ends_at_local is null)
      )
    union
    select dse.starts_at_local, dse.ends_at_local
    from dentist_schedule_exceptions dse
    where dse.clinic_id = p_clinic_id and dse.location_id = p_location_id and dse.dentist_id = p_dentist_id
      and dse.exception_date = p_date and not dse.unavailable
  ), candidates as (
    select distinct slot_start,
           slot_start + make_interval(mins => settings.duration_minutes) as slot_end,
           settings.timezone
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
      select 1 from dentist_schedule_exceptions dse
      where dse.clinic_id = p_clinic_id and dse.location_id = p_location_id and dse.dentist_id = p_dentist_id
        and dse.exception_date = p_date and dse.unavailable
        and dse.starts_at_local is not null and dse.ends_at_local is not null
        and tstzrange((p_date + dse.starts_at_local) at time zone candidates.timezone,
                      (p_date + dse.ends_at_local) at time zone candidates.timezone, '[)')
            && tstzrange(candidates.slot_start, candidates.slot_end, '[)')
    )
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
