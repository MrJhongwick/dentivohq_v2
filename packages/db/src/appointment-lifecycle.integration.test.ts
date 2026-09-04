import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const sql = postgres(process.env.TEST_DATABASE_URL!, { max: 2 });

describe.sequential('appointment lifecycle atomicity', () => {
  const suffix = randomUUID().slice(0, 8);
  const userId = `lifecycle-user-${suffix}`;
  const clinicId = randomUUID();
  const locationId = randomUUID();
  const dentistId = randomUUID();
  const serviceId = randomUUID();
  const profileId = randomUUID();
  const patientId = randomUUID();
  let appointmentId = '';

  beforeAll(async () => {
    await sql`insert into users(id, name, email, email_verified) values(${userId}, 'Lifecycle User', ${`${suffix}@example.test`}, true)`;
    await sql`insert into clinics(id, name, slug, created_by) values(${clinicId}, 'Lifecycle Clinic', ${`lifecycle-${suffix}`}, ${userId})`;
    await sql`insert into clinic_members(clinic_id, user_id, role, status) values(${clinicId}, ${userId}, 'CLINIC_OWNER', 'ACTIVE')`;
    await sql`insert into clinic_settings(clinic_id, slot_interval_minutes) values(${clinicId}, 30)`;
    await sql`insert into clinic_locations(id, clinic_id, name, timezone) values(${locationId}, ${clinicId}, 'Main', 'UTC')`;
    await sql`insert into dentists(id, clinic_id, display_name) values(${dentistId}, ${clinicId}, 'Dr Lifecycle')`;
    await sql`insert into services(id, clinic_id, name, duration_minutes) values(${serviceId}, ${clinicId}, 'Lifecycle visit', 30)`;
    await sql`insert into dentist_location_assignments(clinic_id, dentist_id, location_id) values(${clinicId}, ${dentistId}, ${locationId})`;
    await sql`insert into dentist_services(clinic_id, dentist_id, service_id) values(${clinicId}, ${dentistId}, ${serviceId})`;
    await sql`insert into patient_profiles(id, clinic_id, display_name, email) values(${profileId}, ${clinicId}, 'Lifecycle Patient', ${`patient-${suffix}@example.test`})`;
    await sql`insert into clinic_patients(id, clinic_id, patient_profile_id) values(${patientId}, ${clinicId}, ${profileId})`;
    await sql`insert into dentist_schedules(clinic_id, dentist_id, location_id, day_of_week, starts_at_local, ends_at_local, effective_from, effective_to) values
      (${clinicId}, ${dentistId}, ${locationId}, 1, '09:00', '17:00', '2027-03-01', '2027-03-01'),
      (${clinicId}, ${dentistId}, ${locationId}, 2, '09:00', '17:00', '2027-03-02', '2027-03-02')`;
    const created = await sql`select * from book_clinic_appointment(${userId}, ${clinicId}, ${locationId}, ${dentistId}, ${patientId}, ${serviceId}, '2027-03-01T09:00:00Z', 'Lifecycle notes')`;
    appointmentId = String(created[0]!.id);
  });

  afterAll(async () => {
    await sql`delete from clinics where id = ${clinicId}`;
    await sql`delete from users where id = ${userId}`;
    await sql.end();
  });

  it('records allowed transitions in history and audit logs', async () => {
    await sql`select * from change_appointment_status(${userId}, ${clinicId}, ${appointmentId}, 'CONFIRMED')`;
    const history = await sql`select from_status, to_status, changed_by from appointment_status_history where clinic_id = ${clinicId} and appointment_id = ${appointmentId} order by changed_at`;
    expect(history).toEqual([
      expect.objectContaining({ from_status: null, to_status: 'PENDING', changed_by: userId }),
      expect.objectContaining({ from_status: 'PENDING', to_status: 'CONFIRMED', changed_by: userId })
    ]);
    const audits = await sql`select action, metadata from audit_logs where clinic_id = ${clinicId} and resource_id = ${appointmentId} order by created_at`;
    expect(audits).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'APPOINTMENT_CREATED' }),
      expect.objectContaining({ action: 'APPOINTMENT_STATUS_CHANGED', metadata: { from: 'PENDING', to: 'CONFIRMED' } })
    ]));
  });

  it('rolls back every side effect for denied transitions and unavailable reschedules', async () => {
    const before = await counts();
    await expect(sql`select * from change_appointment_status(${userId}, ${clinicId}, ${appointmentId}, 'COMPLETED')`).rejects.toMatchObject({ code: 'P0003' });
    await expect(sql`select * from reschedule_appointment(${userId}, ${clinicId}, ${appointmentId}, '2027-03-02T18:00:00Z')`).rejects.toMatchObject({ code: '23P01' });
    expect(await counts()).toEqual(before);
    expect((await sql`select status from appointments where id = ${appointmentId}`)[0]!.status).toBe('CONFIRMED');
  });

  it('atomically links a replacement and creates its history, audit, and notification jobs', async () => {
    const replacement = await sql`select * from reschedule_appointment(${userId}, ${clinicId}, ${appointmentId}, '2027-03-02T10:00:00Z')`;
    const replacementId = String(replacement[0]!.id);
    const appointments = await sql`select id, status, is_active from appointments where id in (${appointmentId}, ${replacementId}) order by id`;
    expect(appointments).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: appointmentId, status: 'RESCHEDULED', is_active: false }),
      expect.objectContaining({ id: replacementId, status: 'CONFIRMED', is_active: true })
    ]));
    const replacementAudit = await sql`select metadata from audit_logs where clinic_id = ${clinicId} and action = 'APPOINTMENT_RESCHEDULED' and resource_id = ${replacementId}`;
    expect(replacementAudit[0]!.metadata).toEqual({ previousAppointmentId: appointmentId });
    const replacementHistory = await sql`select from_status, to_status from appointment_status_history where clinic_id = ${clinicId} and appointment_id = ${replacementId}`;
    expect(replacementHistory).toEqual([expect.objectContaining({ from_status: null, to_status: 'CONFIRMED' })]);
    const jobs = await sql`select event_type from notification_jobs where clinic_id = ${clinicId} and payload->>'appointmentId' = ${replacementId}`;
    expect(jobs.map((job) => job.event_type).sort()).toEqual(['APPOINTMENT_CONFIRMATION', 'APPOINTMENT_REMINDER']);
  });

  async function counts() {
    const rows = await sql`select
      (select count(*)::int from appointments where clinic_id = ${clinicId}) appointments,
      (select count(*)::int from appointment_status_history where clinic_id = ${clinicId}) history,
      (select count(*)::int from audit_logs where clinic_id = ${clinicId}) audits,
      (select count(*)::int from notification_jobs where clinic_id = ${clinicId}) jobs`;
    return rows[0];
  }
});
