import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const sql = postgres(process.env.TEST_DATABASE_URL!, { max: 2 });

describe.sequential('appointment idempotency', () => {
  const suffix = randomUUID().slice(0, 8);
  const userId = `idempotency-user-${suffix}`;
  const clinicId = randomUUID();
  const locationId = randomUUID();
  const dentistId = randomUUID();
  const serviceId = randomUUID();
  const profileId = randomUUID();
  const clinicPatientId = randomUUID();
  const clinicSlug = `idempotency-${suffix}`;
  const patientEmail = `staff-${suffix}@example.test`;
  const publicEmail = `public-${suffix}@example.test`;
  const dateAt = (days: number) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + days);
    date.setUTCHours(10, 0, 0, 0);
    return date;
  };
  const staffStart = dateAt(14);
  const publicStart = dateAt(15);
  const rescheduleStart = dateAt(16);
  let originalAppointmentId = '';

  beforeAll(async () => {
    await sql`insert into users(id, name, email, email_verified) values(${userId}, 'Idempotency User', ${`${suffix}@example.test`}, true)`;
    await sql`insert into clinics(id, name, slug, created_by) values(${clinicId}, 'Idempotency Clinic', ${clinicSlug}, ${userId})`;
    await sql`insert into clinic_members(clinic_id, user_id, role, status) values(${clinicId}, ${userId}, 'CLINIC_OWNER', 'ACTIVE')`;
    await sql`insert into clinic_locations(id, clinic_id, name, timezone) values(${locationId}, ${clinicId}, 'Main', 'UTC')`;
    await sql`insert into dentists(id, clinic_id, display_name) values(${dentistId}, ${clinicId}, 'Dr Retry')`;
    await sql`insert into services(id, clinic_id, name, duration_minutes) values(${serviceId}, ${clinicId}, 'Retry-safe visit', 30)`;
    await sql`insert into dentist_location_assignments(clinic_id, dentist_id, location_id) values(${clinicId}, ${dentistId}, ${locationId})`;
    await sql`insert into dentist_services(clinic_id, dentist_id, service_id) values(${clinicId}, ${dentistId}, ${serviceId})`;
    await sql`insert into patient_profiles(id, display_name, email) values(${profileId}, 'Staff Patient', ${patientEmail})`;
    await sql`insert into clinic_patients(id, clinic_id, patient_profile_id) values(${clinicPatientId}, ${clinicId}, ${profileId})`;
    for (const startsAt of [staffStart, publicStart, rescheduleStart]) {
      const date = startsAt.toISOString().slice(0, 10);
      await sql`insert into dentist_schedules(clinic_id, dentist_id, location_id, day_of_week, starts_at_local, ends_at_local, effective_from, effective_to)
        values(${clinicId}, ${dentistId}, ${locationId}, ${startsAt.getUTCDay()}, '09:00', '17:00', ${date}, ${date})`;
    }
  });

  afterAll(async () => {
    await sql`delete from clinics where id = ${clinicId}`;
    await sql`delete from patient_profiles where email in (${patientEmail}, ${publicEmail})`;
    await sql`delete from users where id = ${userId}`;
    await sql.end();
  });

  it('returns the original staff booking and rejects a mismatched retry', async () => {
    const key = `staff:${randomUUID()}`;
    const book = (notes: string) => sql`select * from idempotent_book_clinic_appointment(
      ${userId}, ${clinicId}, ${locationId}, ${dentistId}, ${clinicPatientId}, ${serviceId}, ${staffStart.toISOString()}, ${notes}, ${key}
    )`;
    const first = await book('same request');
    const retry = await book('same request');
    originalAppointmentId = String(first[0]?.id);
    expect(retry[0]?.id).toBe(first[0]?.id);
    await expect(book('different request')).rejects.toMatchObject({ code: 'P0004' });
  });

  it('returns the original public booking on retry', async () => {
    const key = `public:${randomUUID()}`;
    const book = () => sql`select * from idempotent_book_public_appointment(
      ${clinicSlug}, ${locationId}, ${dentistId}, ${serviceId}, ${publicStart.toISOString()},
      'Public Patient', ${publicEmail}, '+15555550100', ${key}
    )`;
    const first = await book();
    const retry = await book();
    expect(retry[0]?.id).toBe(first[0]?.id);
  });

  it('returns the replacement appointment on a rescheduling retry', async () => {
    const key = `reschedule:${randomUUID()}`;
    const reschedule = () => sql`select * from idempotent_reschedule_appointment(
      ${userId}, ${clinicId}, ${originalAppointmentId}, ${rescheduleStart.toISOString()}, ${key}
    )`;
    const first = await reschedule();
    const retry = await reschedule();
    expect(retry[0]?.id).toBe(first[0]?.id);
  });
});
