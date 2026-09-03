import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from './client';
import { findActiveMembership } from './repositories';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required to run authorization integration tests.');
const sql = postgres(databaseUrl, { max: 2 });
const db = sql as unknown as Database;

describe('authentication and clinic membership boundaries', () => {
  const suffix = randomUUID().slice(0, 8);
  const ownerId = `auth-owner-${suffix}`;
  const suspendedId = `auth-suspended-${suffix}`;
  const removedId = `auth-removed-${suffix}`;
  const outsiderId = `auth-outsider-${suffix}`;
  const clinicId = randomUUID();
  const otherClinicId = randomUUID();

  beforeAll(async () => {
    await sql`insert into users(id, name, email, email_verified) values
      (${ownerId}, 'Owner', ${`owner-${suffix}@example.test`}, true),
      (${suspendedId}, 'Suspended', ${`suspended-${suffix}@example.test`}, true),
      (${removedId}, 'Removed', ${`removed-${suffix}@example.test`}, true),
      (${outsiderId}, 'Outsider', ${`outsider-${suffix}@example.test`}, true)`;
    await sql`insert into clinics(id, name, slug, created_by) values
      (${clinicId}, 'Authorization Clinic', ${`auth-${suffix}`}, ${ownerId}),
      (${otherClinicId}, 'Other Clinic', ${`other-auth-${suffix}`}, ${ownerId})`;
    await sql`insert into clinic_members(clinic_id, user_id, role, status) values
      (${clinicId}, ${ownerId}, 'CLINIC_OWNER', 'ACTIVE'),
      (${clinicId}, ${suspendedId}, 'RECEPTIONIST', 'SUSPENDED'),
      (${clinicId}, ${removedId}, 'DENTIST', 'REMOVED')`;
  });

  afterAll(async () => {
    await sql`delete from clinics where id in (${clinicId}, ${otherClinicId})`;
    await sql`delete from users where id in (${ownerId}, ${suspendedId}, ${removedId}, ${outsiderId})`;
    await sql.end();
  });

  it('allows an active member only inside the requested clinic', async () => {
    await expect(findActiveMembership(db, ownerId, clinicId)).resolves.toMatchObject({ role: 'CLINIC_OWNER', status: 'ACTIVE' });
    await expect(findActiveMembership(db, ownerId, otherClinicId)).resolves.toBeNull();
  });

  it.each([
    ['suspended', suspendedId],
    ['removed', removedId],
    ['non-member', outsiderId]
  ])('denies a %s user', async (_label, userId) => {
    await expect(findActiveMembership(db, userId, clinicId)).resolves.toBeNull();
  });
});
