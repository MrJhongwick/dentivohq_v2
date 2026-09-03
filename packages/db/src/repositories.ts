import type { AvailabilityQuery, CreateAppointmentInput, CreateClinicInput, CreateDentistInput, CreateLocationInput, CreatePatientInput, CreateScheduleInput, CreateServiceInput, FileOwnerType, InviteStaffInput, PublicBookingInput, RescheduleAppointmentInput } from '@dentivohq/validation';
import type { AppointmentRecord, ClinicMembership } from './types';
import type { Database } from './client';

function mapAppointment(row: Record<string, unknown>): AppointmentRecord {
  return {
    id: String(row.id), clinicId: String(row.clinic_id), locationId: String(row.location_id),
    dentistId: String(row.dentist_id), clinicPatientId: String(row.clinic_patient_id), serviceId: String(row.service_id),
    startsAt: new Date(String(row.starts_at)).toISOString(), endsAt: new Date(String(row.ends_at)).toISOString(),
    status: row.status as AppointmentRecord['status'], patientDisplayName: String(row.patient_display_name), serviceName: String(row.service_name)
  };
}

export async function findActiveMembership(db: Database, userId: string, clinicId: string): Promise<ClinicMembership | null> {
  const rows = await db`
    select id, clinic_id, user_id, role, status
    from clinic_members
    where clinic_id = ${clinicId} and user_id = ${userId} and status = 'ACTIVE'
    limit 1
  `;
  const row = rows[0];
  return row ? { id: String(row.id), clinicId: String(row.clinic_id), userId: String(row.user_id), role: row.role as ClinicMembership['role'], status: 'ACTIVE' } : null;
}

export async function listUserClinics(db: Database, userId: string) {
  return db`
    select c.id, c.name, c.slug, cm.role
    from clinic_members cm join clinics c on c.id = cm.clinic_id
    where cm.user_id = ${userId} and cm.status = 'ACTIVE' and c.status = 'ACTIVE'
    order by c.name
  `;
}

export async function createClinic(db: Database, userId: string, input: CreateClinicInput) {
  const rows = await db`
    with clinic as (
      insert into clinics(name, slug, created_by) values(${input.name}, ${input.slug}, ${userId}) returning *
    ), member as (
      insert into clinic_members(clinic_id, user_id, role, status) select id, ${userId}, 'CLINIC_OWNER', 'ACTIVE' from clinic
    ), settings as (
      insert into clinic_settings(clinic_id) select id from clinic
    ), subscription as (
      insert into subscriptions(clinic_id, plan, status) select id, 'FREE', 'ACTIVE' from clinic
    ), audit as (
      insert into audit_logs(clinic_id, actor_user_id, action, resource_type, resource_id)
      select id, ${userId}, 'CLINIC_CREATED', 'clinic', id::text from clinic
    ) select id, name, slug, 'CLINIC_OWNER'::text as role from clinic
  `;
  return rows[0];
}

export async function createLocation(db: Database, clinicId: string, userId: string, input: CreateLocationInput) {
  const rows = await db`
    with inserted as (
      insert into clinic_locations(clinic_id, name, timezone, address_line_1, city, region, postal_code, country_code)
      values(${clinicId}, ${input.name}, ${input.timezone}, ${input.addressLine1 ?? null}, ${input.city ?? null}, ${input.region ?? null}, ${input.postalCode ?? null}, ${input.countryCode ?? null}) returning *
    ), audit as (
      insert into audit_logs(clinic_id, actor_user_id, action, resource_type, resource_id)
      select ${clinicId}, ${userId}, 'CLINIC_LOCATION_CREATED', 'clinic_location', id::text from inserted
    ) select * from inserted
  `;
  return rows[0];
}

export async function createStaffInvitation(db: Database, clinicId: string, userId: string, input: InviteStaffInput, tokenHash: string, expiresAt: string) {
  const rows = await db`
    with inserted as (
      insert into clinic_invitations(clinic_id, email, role, token_hash, expires_at, invited_by)
      values(${clinicId}, ${input.email}, ${input.role}, ${tokenHash}, ${expiresAt}) returning id, email, role, expires_at
    ), audit as (
      insert into audit_logs(clinic_id, actor_user_id, action, resource_type, resource_id)
      select ${clinicId}, ${userId}, 'STAFF_INVITED', 'clinic_invitation', id::text from inserted
    ) select * from inserted
  `;
  return rows[0];
}

export async function acceptStaffInvitation(db: Database, userId: string, userEmail: string, tokenHash: string) {
  const rows = await db`
    with invitation as (
      update clinic_invitations set accepted_at = now()
      where token_hash = ${tokenHash} and email = ${userEmail} and accepted_at is null and expires_at > now()
      returning id, clinic_id, role
    ), member as (
      insert into clinic_members(clinic_id, user_id, role, status)
      select clinic_id, ${userId}, role, 'ACTIVE' from invitation
      on conflict(clinic_id, user_id) do update set role = excluded.role, status = 'ACTIVE'
      returning id, clinic_id, role
    ), audit as (
      insert into audit_logs(clinic_id, actor_user_id, action, resource_type, resource_id)
      select clinic_id, ${userId}, 'STAFF_INVITATION_ACCEPTED', 'clinic_member', id::text from member
    ) select * from member
  `;
  const row = rows[0];
  return row ? { id: String(row.id), clinicId: String(row.clinic_id), role: String(row.role) } : null;
}

export async function assignDentistLocation(db: Database, clinicId: string, dentistId: string, locationId: string) {
  const rows = await db`
    insert into dentist_location_assignments(clinic_id, dentist_id, location_id)
    values(${clinicId}, ${dentistId}, ${locationId}) on conflict do nothing returning *
  `;
  return rows[0] ?? { clinic_id: clinicId, dentist_id: dentistId, location_id: locationId };
}

export async function assignDentistService(db: Database, clinicId: string, dentistId: string, serviceId: string) {
  const rows = await db`
    insert into dentist_services(clinic_id, dentist_id, service_id)
    values(${clinicId}, ${dentistId}, ${serviceId}) on conflict do nothing returning *
  `;
  return rows[0] ?? { clinic_id: clinicId, dentist_id: dentistId, service_id: serviceId };
}

export async function createDentist(db: Database, clinicId: string, userId: string, input: CreateDentistInput) {
  const rows = await db`
    with inserted as (
      insert into dentists(clinic_id, user_id, display_name, license_number)
      values(${clinicId}, ${input.userId ?? null}, ${input.displayName}, ${input.licenseNumber ?? null}) returning *
    ), audit as (
      insert into audit_logs(clinic_id, actor_user_id, action, resource_type, resource_id)
      select ${clinicId}, ${userId}, 'DENTIST_CREATED', 'dentist', id::text from inserted
    ) select * from inserted
  `;
  return rows[0];
}

export async function createService(db: Database, clinicId: string, userId: string, input: CreateServiceInput) {
  const rows = await db`
    with inserted as (
      insert into services(clinic_id, name, description, duration_minutes, price_minor, currency)
      values(${clinicId}, ${input.name}, ${input.description ?? null}, ${input.durationMinutes}, ${input.priceMinor ?? null}, ${input.currency ?? null}) returning *
    ), audit as (
      insert into audit_logs(clinic_id, actor_user_id, action, resource_type, resource_id)
      select ${clinicId}, ${userId}, 'SERVICE_CREATED', 'service', id::text from inserted
    ) select * from inserted
  `;
  return rows[0];
}

export async function createSchedule(db: Database, clinicId: string, userId: string, input: CreateScheduleInput) {
  const rows = await db`
    with inserted as (
      insert into dentist_schedules(clinic_id, dentist_id, location_id, day_of_week, starts_at_local, ends_at_local, effective_from, effective_to)
      values(${clinicId}, ${input.dentistId}, ${input.locationId}, ${input.dayOfWeek}, ${input.startsAtLocal}::time, ${input.endsAtLocal}::time, ${input.effectiveFrom ?? null}::date, ${input.effectiveTo ?? null}::date) returning *
    ), audit as (
      insert into audit_logs(clinic_id, actor_user_id, action, resource_type, resource_id)
      select ${clinicId}, ${userId}, 'DENTIST_SCHEDULE_CREATED', 'dentist_schedule', id::text from inserted
    ) select * from inserted
  `;
  return rows[0];
}

export async function createPatient(db: Database, clinicId: string, userId: string, input: CreatePatientInput) {
  const rows = await db`
    with profile as (
      insert into patient_profiles(clinic_id, display_name, email, phone) values(${clinicId}, ${input.displayName}, ${input.email ?? null}, ${input.phone ?? null})
      on conflict(clinic_id, email) do update set display_name = excluded.display_name, phone = coalesce(excluded.phone, patient_profiles.phone)
      returning id, display_name, email, phone
    ), clinic_patient as (
      insert into clinic_patients(clinic_id, patient_profile_id) select ${clinicId}, id from profile
      on conflict(clinic_id, patient_profile_id) do update set active = true returning id, patient_profile_id
    ), audit as (
      insert into audit_logs(clinic_id, actor_user_id, action, resource_type, resource_id)
      select ${clinicId}, ${userId}, 'PATIENT_CREATED', 'clinic_patient', id::text from clinic_patient
    ) select clinic_patient.id, profile.display_name, profile.email, profile.phone from clinic_patient join profile on profile.id = clinic_patient.patient_profile_id
  `;
  return rows[0];
}

export async function listAppointments(db: Database, clinicId: string, page: number, pageSize: number) {
  const offset = (page - 1) * pageSize;
  const results = await db.transaction((tx) => [
    tx`
      select a.id, a.clinic_id, a.location_id, a.dentist_id, a.clinic_patient_id, a.service_id,
             a.starts_at, a.ends_at, a.status, pp.display_name as patient_display_name, s.name as service_name
      from appointments a
      join clinic_patients cp on cp.id = a.clinic_patient_id and cp.clinic_id = a.clinic_id
      join patient_profiles pp on pp.id = cp.patient_profile_id
      join services s on s.id = a.service_id and s.clinic_id = a.clinic_id
      where a.clinic_id = ${clinicId}
      order by a.starts_at asc
      limit ${pageSize} offset ${offset}
    `,
    tx`select count(*)::int as total from appointments where clinic_id = ${clinicId}`
  ], { readOnly: true });
  const rows = results[0] ?? [];
  const countRows = results[1] ?? [];
  return { data: rows.map((row) => mapAppointment(row)), total: Number(countRows[0]?.total ?? 0) };
}

export async function getClinicDashboardOverview(db: Database, clinicId: string) {
  const results = await db.transaction((tx) => [
    tx`
      select
        count(*) filter (
          where (a.starts_at at time zone cl.timezone)::date = (now() at time zone cl.timezone)::date
            and a.status not in ('CANCELLED', 'RESCHEDULED')
        )::int as today_scheduled,
        count(*) filter (
          where (a.starts_at at time zone cl.timezone)::date = (now() at time zone cl.timezone)::date
            and a.status = 'COMPLETED'
        )::int as completed,
        count(*) filter (
          where (a.starts_at at time zone cl.timezone)::date = (now() at time zone cl.timezone)::date
            and a.status in ('CHECKED_IN', 'IN_PROGRESS')
        )::int as in_progress
      from appointments a
      join clinic_locations cl on cl.id = a.location_id and cl.clinic_id = a.clinic_id
      where a.clinic_id = ${clinicId}
    `,
    tx`
      select count(*)::int as new_patients
      from clinic_patients
      where clinic_id = ${clinicId}
        and created_at >= date_trunc('month', now())
    `,
    tx`
      select a.id, a.clinic_id, a.location_id, a.dentist_id, a.clinic_patient_id, a.service_id,
             a.starts_at, a.ends_at, a.status, pp.display_name as patient_display_name, s.name as service_name
      from appointments a
      join clinic_locations cl on cl.id = a.location_id and cl.clinic_id = a.clinic_id
      join clinic_patients cp on cp.id = a.clinic_patient_id and cp.clinic_id = a.clinic_id
      join patient_profiles pp on pp.id = cp.patient_profile_id
      join services s on s.id = a.service_id and s.clinic_id = a.clinic_id
      where a.clinic_id = ${clinicId}
        and (a.starts_at at time zone cl.timezone)::date = (now() at time zone cl.timezone)::date
        and a.status not in ('CANCELLED', 'RESCHEDULED')
      order by a.starts_at
      limit 5
    `,
    tx`
      select a.id, a.clinic_id, a.location_id, a.dentist_id, a.clinic_patient_id, a.service_id,
             a.starts_at, a.ends_at, a.status, pp.display_name as patient_display_name, s.name as service_name
      from appointments a
      join clinic_patients cp on cp.id = a.clinic_patient_id and cp.clinic_id = a.clinic_id
      join patient_profiles pp on pp.id = cp.patient_profile_id
      join services s on s.id = a.service_id and s.clinic_id = a.clinic_id
      where a.clinic_id = ${clinicId} and a.starts_at >= now()
        and a.status not in ('CANCELLED', 'RESCHEDULED')
      order by a.created_at desc
      limit 4
    `,
    tx`
      select s.name, count(*)::int as appointment_count
      from appointments a
      join services s on s.id = a.service_id and s.clinic_id = a.clinic_id
      where a.clinic_id = ${clinicId}
        and a.starts_at >= date_trunc('month', now())
        and a.status not in ('CANCELLED', 'RESCHEDULED')
      group by s.id, s.name
      order by appointment_count desc, s.name
      limit 5
    `,
    tx`
      select id, name, city, region, timezone
      from clinic_locations
      where clinic_id = ${clinicId} and active = true
      order by created_at
      limit 1
    `,
    tx`
      select plan, status
      from subscriptions
      where clinic_id = ${clinicId}
      limit 1
    `
  ], { readOnly: true });

  const appointmentMetrics = results[0]?.[0] ?? {};
  const patientMetrics = results[1]?.[0] ?? {};
  const todayAppointments = results[2] ?? [];
  const recentBookings = results[3] ?? [];
  const mixRows = results[4] ?? [];
  const totalMix = mixRows.reduce((total, row) => total + Number(row.appointment_count ?? 0), 0);
  const location = results[5]?.[0] ?? null;
  const subscription = results[6]?.[0] ?? null;

  return {
    metrics: {
      todayScheduled: Number(appointmentMetrics.today_scheduled ?? 0),
      completed: Number(appointmentMetrics.completed ?? 0),
      inProgress: Number(appointmentMetrics.in_progress ?? 0),
      newPatientsThisMonth: Number(patientMetrics.new_patients ?? 0)
    },
    todayAppointments: todayAppointments.map((row) => mapAppointment(row)),
    recentBookings: recentBookings.map((row) => mapAppointment(row)),
    treatmentMix: mixRows.map((row) => ({
      name: String(row.name),
      appointmentCount: Number(row.appointment_count),
      percentage: totalMix ? Math.round(Number(row.appointment_count) / totalMix * 100) : 0
    })),
    location,
    subscription
  };
}

export async function createAppointment(db: Database, actorUserId: string, clinicId: string, input: CreateAppointmentInput, idempotencyKey: string) {
  const rows = await db`
    select * from idempotent_book_clinic_appointment(
      ${actorUserId}, ${clinicId}, ${input.locationId}, ${input.dentistId}, ${input.clinicPatientId},
      ${input.serviceId}, ${input.startsAt}::timestamptz, ${input.notes ?? null}, ${idempotencyKey}
    )
  `;
  return mapAppointment(rows[0] as Record<string, unknown>);
}

export async function listAvailability(db: Database, clinicId: string, input: AvailabilityQuery) {
  const rows = await db`
    select starts_at, ends_at from get_available_slots(
      ${clinicId}, ${input.locationId}, ${input.dentistId}, ${input.serviceId}, ${input.date}::date
    )
  `;
  return rows.map((row) => ({ startsAt: new Date(String(row.starts_at)).toISOString(), endsAt: new Date(String(row.ends_at)).toISOString() }));
}

export async function updateAppointmentStatus(db: Database, actorUserId: string, clinicId: string, appointmentId: string, status: string) {
  const rows = await db`select * from change_appointment_status(${actorUserId}, ${clinicId}, ${appointmentId}, ${status}::appointment_status)`;
  return rows[0] ? mapAppointment(rows[0] as Record<string, unknown>) : null;
}

export async function rescheduleAppointment(db: Database, actorUserId: string, clinicId: string, appointmentId: string, input: RescheduleAppointmentInput, idempotencyKey: string) {
  const rows = await db`select * from idempotent_reschedule_appointment(${actorUserId}, ${clinicId}, ${appointmentId}, ${input.startsAt}::timestamptz, ${idempotencyKey})`;
  return rows[0] ? mapAppointment(rows[0] as Record<string, unknown>) : null;
}

export async function getPublicBookingConfig(db: Database, clinicSlug: string) {
  const clinics = await db`select id, name, slug from clinics where slug = ${clinicSlug} and status = 'ACTIVE' limit 1`;
  const clinic = clinics[0];
  if (!clinic) return null;
  const [locations, services, dentists] = await db.transaction((tx) => [
    tx`select id, name, timezone from clinic_locations where clinic_id = ${clinic.id} and active = true order by name`,
    tx`select id, name, duration_minutes from services where clinic_id = ${clinic.id} and active = true order by name`,
    tx`select id, display_name from dentists where clinic_id = ${clinic.id} and active = true order by display_name`
  ], { readOnly: true });
  return { clinic, locations, services, dentists };
}

export async function createPublicAppointment(db: Database, clinicSlug: string, input: PublicBookingInput, idempotencyKey: string) {
  const rows = await db`
    select * from idempotent_book_public_appointment(
      ${clinicSlug}, ${input.locationId}, ${input.dentistId}, ${input.serviceId}, ${input.startsAt}::timestamptz,
      ${input.patient.name}, ${input.patient.email}, ${input.patient.phone}, ${idempotencyKey}
    )
  `;
  return mapAppointment(rows[0] as Record<string, unknown>);
}

export async function getPlatformOverview(db: Database, userId: string) {
  const admins = await db`select id from users where id = ${userId} and platform_role = 'PLATFORM_ADMIN' limit 1`;
  if (!admins[0]) return null;
  const results = await db.transaction((tx) => [
    tx`select count(*)::int as value from clinics`,
    tx`select count(*)::int as value from users`,
    tx`select count(*)::int as value from appointments where starts_at >= date_trunc('day', now()) and starts_at < date_trunc('day', now()) + interval '1 day'`
  ], { readOnly: true });
  const clinics = results[0] ?? [];
  const users = results[1] ?? [];
  const appointments = results[2] ?? [];
  return { clinics: Number(clinics[0]?.value ?? 0), users: Number(users[0]?.value ?? 0), appointmentsToday: Number(appointments[0]?.value ?? 0) };
}

export async function fileOwnerBelongsToClinic(db: Database, clinicId: string, ownerType: FileOwnerType, ownerId: string) {
  const rows = await db`select file_owner_belongs_to_clinic(${clinicId}, ${ownerType}::file_owner_type, ${ownerId}) as belongs`;
  return rows[0]?.belongs === true;
}

type FileMetadataInput = { clinicId: string; ownerType: FileOwnerType; ownerId: string; bucket: string; objectKey: string; mimeType: string; sizeBytes: number; createdBy: string };

export async function reserveFileMetadata(db: Database, input: FileMetadataInput) {
  const rows = await db`
    insert into file_objects(clinic_id, owner_type, owner_id, bucket, object_key, mime_type, size_bytes, created_by, status)
    values(${input.clinicId}, ${input.ownerType}::file_owner_type, ${input.ownerId}, ${input.bucket}, ${input.objectKey}, ${input.mimeType}, ${input.sizeBytes}, ${input.createdBy}, 'PENDING_UPLOAD')
    returning *
  `;
  return rows[0] ?? null;
}

export async function activateFileMetadata(db: Database, clinicId: string, fileId: string) {
  const rows = await db`
    with activated as (
      update file_objects set status = 'ACTIVE'
      where id = ${fileId} and clinic_id = ${clinicId} and status = 'PENDING_UPLOAD'
      returning *
    ), audited as (
      insert into audit_logs(clinic_id, actor_user_id, action, resource_type, resource_id)
      select clinic_id, created_by, 'FILE_UPLOADED', 'file', id::text from activated
    ) select * from activated
  `;
  return rows[0] ?? null;
}

export async function abandonFileMetadata(db: Database, clinicId: string, fileId: string) {
  await db`delete from file_objects where id = ${fileId} and clinic_id = ${clinicId} and status = 'PENDING_UPLOAD'`;
}

export async function findFileMetadata(db: Database, clinicId: string, fileId: string) {
  const rows = await db`select * from file_objects where id = ${fileId} and clinic_id = ${clinicId} and status = 'ACTIVE' limit 1`;
  return rows[0] ?? null;
}

export async function beginFileDeletion(db: Database, clinicId: string, fileId: string) {
  const rows = await db`
    update file_objects set status = 'DELETE_PENDING'
    where id = ${fileId} and clinic_id = ${clinicId} and status in ('ACTIVE', 'DELETE_PENDING')
    returning *
  `;
  return rows[0] ?? null;
}

export async function finalizeFileDeletion(db: Database, clinicId: string, fileId: string, actorUserId?: string) {
  const rows = await db`
    with deleted as (
      delete from file_objects
      where id = ${fileId} and clinic_id = ${clinicId} and status = 'DELETE_PENDING'
      returning id, clinic_id, created_by
    ), audited as (
      insert into audit_logs(clinic_id, actor_user_id, action, resource_type, resource_id)
      select clinic_id, ${actorUserId ?? null}, 'FILE_DELETED', 'file', id::text from deleted
    ) select * from deleted
  `;
  return rows[0] ?? null;
}

export async function listFileMetadataForReconciliation(db: Database, limit = 100) {
  return db`
    select * from file_objects
    where status = 'ACTIVE'
       or (status in ('PENDING_UPLOAD', 'DELETE_PENDING') and updated_at < now() - interval '10 minutes')
    order by case status when 'DELETE_PENDING' then 0 when 'PENDING_UPLOAD' then 1 else 2 end, updated_at
    limit ${limit}
  `;
}

export async function findFileMetadataByObjectKey(db: Database, objectKey: string) {
  const rows = await db`select id from file_objects where object_key = ${objectKey} limit 1`;
  return rows[0] ?? null;
}

export async function removeMissingFileMetadata(db: Database, clinicId: string, fileId: string) {
  await db`
    with deleted as (
      delete from file_objects where id = ${fileId} and clinic_id = ${clinicId} returning id, clinic_id
    )
    insert into audit_logs(clinic_id, action, resource_type, resource_id)
    select clinic_id, 'FILE_RECONCILED_MISSING', 'file', id::text from deleted
  `;
}

export async function claimNotificationJobs(db: Database, limit = 25) {
  return db`select * from claim_notification_jobs(${limit})`;
}

export async function completeNotificationJob(db: Database, jobId: string) {
  await db.transaction((tx) => [
    tx`update notification_jobs set status = 'DELIVERED' where id = ${jobId}`,
    tx`insert into notification_deliveries(clinic_id, job_id, provider, status) select clinic_id, id, 'RESEND', 'DELIVERED' from notification_jobs where id = ${jobId}`
  ]);
}

export async function failNotificationJob(db: Database, jobId: string, errorCode: string) {
  await db.transaction((tx) => [
    tx`update notification_jobs set status = case when attempts >= 5 then 'FAILED' else 'PENDING' end, scheduled_for = now() + interval '5 minutes' where id = ${jobId}`,
    tx`insert into notification_deliveries(clinic_id, job_id, provider, status, error_code) select clinic_id, id, 'RESEND', 'FAILED', ${errorCode} from notification_jobs where id = ${jobId}`
  ]);
}
