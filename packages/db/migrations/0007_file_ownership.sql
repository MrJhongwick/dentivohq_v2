create type file_owner_type as enum ('CLINIC_PATIENT', 'APPOINTMENT');

do $$
begin
  if exists (
    select 1 from file_objects
    where owner_type not in ('patient', 'clinic_patient', 'appointment', 'CLINIC_PATIENT', 'APPOINTMENT')
  ) then
    raise exception 'Unsupported file owner type exists; resolve it before applying this migration';
  end if;
end;
$$;

update file_objects set owner_type = 'CLINIC_PATIENT' where owner_type in ('patient', 'clinic_patient');
update file_objects set owner_type = 'APPOINTMENT' where owner_type = 'appointment';
alter table file_objects alter column owner_type type file_owner_type using owner_type::file_owner_type;

create function file_owner_belongs_to_clinic(
  p_clinic_id uuid,
  p_owner_type file_owner_type,
  p_owner_id uuid
) returns boolean language sql stable as $$
  select case p_owner_type
    when 'CLINIC_PATIENT' then exists (
      select 1 from clinic_patients
      where clinic_id = p_clinic_id and id = p_owner_id and active
    )
    when 'APPOINTMENT' then exists (
      select 1 from appointments
      where clinic_id = p_clinic_id and id = p_owner_id
    )
  end;
$$;

create function enforce_file_owner_tenant() returns trigger language plpgsql as $$
begin
  if not file_owner_belongs_to_clinic(new.clinic_id, new.owner_type, new.owner_id) then
    raise exception 'File owner does not belong to clinic' using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger file_objects_owner_tenant
before insert or update of clinic_id, owner_type, owner_id on file_objects
for each row execute function enforce_file_owner_tenant();
