import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const sql = postgres(process.env.TEST_DATABASE_URL!, { max: 2 });

describe.sequential('notification job leases', () => {
  const suffix = randomUUID().slice(0, 8);
  const userId = `notification-user-${suffix}`;
  const clinicId = randomUUID(); const locationId = randomUUID(); const dentistId = randomUUID();
  const serviceId = randomUUID(); const profileId = randomUUID(); const patientId = randomUUID(); const appointmentId = randomUUID();

  beforeAll(async () => {
    await sql`insert into users(id, name, email, email_verified) values(${userId}, 'Notification User', ${`${suffix}@example.test`}, true)`;
    await sql`insert into clinics(id, name, slug, created_by) values(${clinicId}, 'Notification Clinic', ${`notification-${suffix}`}, ${userId})`;
    await sql`insert into clinic_locations(id, clinic_id, name, timezone) values(${locationId}, ${clinicId}, 'Manila', 'Asia/Manila')`;
    await sql`insert into dentists(id, clinic_id, display_name) values(${dentistId}, ${clinicId}, 'Dr Notify')`;
    await sql`insert into services(id, clinic_id, name, duration_minutes) values(${serviceId}, ${clinicId}, 'Notify visit', 30)`;
    await sql`insert into patient_profiles(id, clinic_id, display_name, email) values(${profileId}, ${clinicId}, 'Notify Patient', ${`patient-${suffix}@example.test`})`;
    await sql`insert into clinic_patients(id, clinic_id, patient_profile_id) values(${patientId}, ${clinicId}, ${profileId})`;
    await sql`insert into appointments(id, clinic_id, location_id, dentist_id, clinic_patient_id, service_id, starts_at, ends_at, status)
      values(${appointmentId}, ${clinicId}, ${locationId}, ${dentistId}, ${patientId}, ${serviceId}, now() + interval '2 days', now() + interval '2 days 30 minutes', 'CONFIRMED')`;
    await sql`update notification_jobs set scheduled_for = now() - interval '1 minute' where clinic_id = ${clinicId}`;
  });

  afterAll(async () => { await sql`delete from clinics where id = ${clinicId}`; await sql`delete from users where id = ${userId}`; await sql.end(); });

  it('reclaims an expired lease and rejects completion by the stale worker', async () => {
    const first = await sql`select * from claim_notification_jobs(100)`;
    const claimed = first.find((job) => String(job.clinic_id) === clinicId)!;
    const jobId = String(claimed.job_id); const staleToken = String(claimed.lease_token);
    expect(String(claimed.body_text)).toContain('Asia/Manila');
    await sql`update notification_jobs set lease_expires_at = now() - interval '1 second' where id = ${jobId}`;
    const reclaimed = await sql`select * from claim_notification_jobs(100)`;
    const currentToken = String(reclaimed.find((job) => String(job.job_id) === jobId)!.lease_token);
    expect(currentToken).not.toBe(staleToken);
    expect(await complete(jobId, staleToken)).toHaveLength(0);
    expect(await complete(jobId, currentToken)).toHaveLength(1);
  });

  it('cancels pending work when its appointment is cancelled', async () => {
    await sql`update appointments set status = 'CANCELLED', is_active = false where id = ${appointmentId}`;
    await sql`select * from claim_notification_jobs(25)`;
    const jobs = await sql`select status from notification_jobs where clinic_id = ${clinicId}`;
    expect(jobs.every((job) => ['DELIVERED', 'CANCELLED'].includes(String(job.status)))).toBe(true);
  });

  function complete(jobId: string, token: string) {
    return sql`update notification_jobs set status = 'DELIVERED', lease_token = null, lease_expires_at = null where id = ${jobId} and status = 'PROCESSING' and lease_token = ${token} returning id`;
  }
});
