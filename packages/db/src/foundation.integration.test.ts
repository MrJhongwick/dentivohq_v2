import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const databaseUrl = process.env.TEST_DATABASE_URL;
const sql = databaseUrl ? postgres(databaseUrl, { max: 2 }) : null;
const run = databaseUrl ? describe : describe.skip;

run('PostgreSQL tenant and booking safeguards', () => {
  const suffix = randomUUID().slice(0, 8);
  const userId = `test-user-${suffix}`;
  const clinicA = randomUUID(); const clinicB = randomUUID(); const location = randomUUID();
  const dentist = randomUUID(); const service = randomUUID(); const profile = randomUUID(); const patient = randomUUID();

  beforeAll(async () => {
    if (!sql) return;
    await sql`insert into users(id, name, email, email_verified) values(${userId}, 'Integration User', ${`${suffix}@example.test`}, true)`;
    await sql`insert into clinics(id, name, slug, created_by) values(${clinicA}, 'Clinic A', ${`clinic-a-${suffix}`}, ${userId}), (${clinicB}, 'Clinic B', ${`clinic-b-${suffix}`}, ${userId})`;
    await sql`insert into clinic_members(clinic_id, user_id, role, status) values(${clinicA}, ${userId}, 'CLINIC_OWNER', 'ACTIVE')`;
    await sql`insert into clinic_locations(id, clinic_id, name, timezone) values(${location}, ${clinicA}, 'Main', 'UTC')`;
    await sql`insert into dentists(id, clinic_id, display_name) values(${dentist}, ${clinicA}, 'Dr Test')`;
    await sql`insert into services(id, clinic_id, name, duration_minutes) values(${service}, ${clinicA}, 'Consultation', 30)`;
    await sql`insert into patient_profiles(id, display_name, email) values(${profile}, 'Test Patient', ${`patient-${suffix}@example.test`})`;
    await sql`insert into clinic_patients(id, clinic_id, patient_profile_id) values(${patient}, ${clinicA}, ${profile})`;
  });

  afterAll(async () => {
    if (!sql) return;
    await sql`delete from clinics where id in (${clinicA}, ${clinicB})`;
    await sql`delete from patient_profiles where id = ${profile}`;
    await sql`delete from users where id = ${userId}`;
    await sql.end();
  });

  it('resolves membership only for the requested clinic', async () => {
    if (!sql) return;
    const allowed = await sql`select id from clinic_members where clinic_id = ${clinicA} and user_id = ${userId} and status = 'ACTIVE'`;
    const denied = await sql`select id from clinic_members where clinic_id = ${clinicB} and user_id = ${userId} and status = 'ACTIVE'`;
    expect(allowed).toHaveLength(1);
    expect(denied).toHaveLength(0);
  });

  it('rejects overlapping active appointments for one dentist', async () => {
    if (!sql) return;
    const start = new Date(Date.now() + 86_400_000).toISOString();
    const end = new Date(Date.now() + 86_400_000 + 1_800_000).toISOString();
    await sql`insert into appointments(clinic_id, location_id, dentist_id, clinic_patient_id, service_id, starts_at, ends_at, created_by) values(${clinicA}, ${location}, ${dentist}, ${patient}, ${service}, ${start}, ${end}, ${userId})`;
    await expect(sql`insert into appointments(clinic_id, location_id, dentist_id, clinic_patient_id, service_id, starts_at, ends_at, created_by) values(${clinicA}, ${location}, ${dentist}, ${patient}, ${service}, ${start}, ${end}, ${userId})`).rejects.toMatchObject({ code: '23P01' });
  });

  it('allows exactly one of two simultaneous conflicting bookings', async () => {
    if (!sql) return;
    const startsAt = new Date(Date.now() + 172_800_000).toISOString();
    const endsAt = new Date(Date.now() + 172_800_000 + 1_800_000).toISOString();
    const insert = () => sql`
      insert into appointments(clinic_id, location_id, dentist_id, clinic_patient_id, service_id, starts_at, ends_at, created_by)
      values(${clinicA}, ${location}, ${dentist}, ${patient}, ${service}, ${startsAt}, ${endsAt}, ${userId})
    `;
    const outcomes = await Promise.allSettled([insert(), insert()]);
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === 'rejected')).toHaveLength(1);
  });
});
