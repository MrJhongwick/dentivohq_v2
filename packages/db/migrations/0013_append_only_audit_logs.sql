create function protect_audit_logs() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' or (tg_op = 'DELETE' and pg_trigger_depth() = 1) then
    raise exception 'Audit logs are append-only' using errcode = '42501';
  end if;
  return old;
end;
$$;

create trigger audit_logs_append_only
before update or delete on audit_logs
for each row execute function protect_audit_logs();

revoke update, delete, truncate on audit_logs from public;
