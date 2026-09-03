create function clinic_plan_limit(target_clinic_id uuid, entitlement_key text) returns integer
language sql stable as $$
  select coalesce(
    (entitlements ->> entitlement_key)::integer,
    case plan
      when 'STARTER' then case entitlement_key when 'max_locations' then 3 when 'max_dentists' then 10 when 'max_staff' then 20 end
      else case entitlement_key when 'max_locations' then 1 when 'max_dentists' then 3 when 'max_staff' then 5 end
    end
  )
  from subscriptions where clinic_id = target_clinic_id and status in ('ACTIVE', 'TRIALING')
$$;

create function enforce_location_plan_limit() returns trigger language plpgsql as $$
declare allowed integer;
begin
  if new.active and (tg_op = 'INSERT' or not old.active) then
    perform pg_advisory_xact_lock(hashtext(new.clinic_id::text));
    allowed := coalesce(clinic_plan_limit(new.clinic_id, 'max_locations'), 1);
    if (select count(*) from clinic_locations where clinic_id = new.clinic_id and active and id <> new.id) >= allowed then
      raise exception 'Location plan limit reached' using errcode = 'P0005';
    end if;
  end if;
  return new;
end;
$$;
create trigger clinic_locations_plan_limit before insert or update of active on clinic_locations for each row execute function enforce_location_plan_limit();

create function enforce_dentist_plan_limit() returns trigger language plpgsql as $$
declare allowed integer;
begin
  if new.active and (tg_op = 'INSERT' or not old.active) then
    perform pg_advisory_xact_lock(hashtext(new.clinic_id::text));
    allowed := coalesce(clinic_plan_limit(new.clinic_id, 'max_dentists'), 3);
    if (select count(*) from dentists where clinic_id = new.clinic_id and active and id <> new.id) >= allowed then
      raise exception 'Dentist plan limit reached' using errcode = 'P0005';
    end if;
  end if;
  return new;
end;
$$;
create trigger dentists_plan_limit before insert or update of active on dentists for each row execute function enforce_dentist_plan_limit();

create function enforce_staff_plan_limit() returns trigger language plpgsql as $$
declare allowed integer;
begin
  if new.status = 'ACTIVE' and (tg_op = 'INSERT' or old.status <> 'ACTIVE') then
    perform pg_advisory_xact_lock(hashtext(new.clinic_id::text));
    allowed := coalesce(clinic_plan_limit(new.clinic_id, 'max_staff'), 5);
    if (select count(*) from clinic_members where clinic_id = new.clinic_id and status = 'ACTIVE' and id <> new.id) >= allowed then
      raise exception 'Staff plan limit reached' using errcode = 'P0005';
    end if;
  end if;
  return new;
end;
$$;
create trigger clinic_members_plan_limit before insert or update of status on clinic_members for each row execute function enforce_staff_plan_limit();
