import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required to run plan entitlement integration tests.');
const sql = postgres(databaseUrl, { max: 2 });

describe('transactional plan entitlements', () => {
  const suffix = randomUUID().slice(0, 8); const userId = `plan-owner-${suffix}`; const clinicId = randomUUID();
  beforeAll(async () => {
    await sql`insert into users(id, name, email, email_verified) values(${userId}, 'Plan Owner', ${`plan-${suffix}@example.test`}, true)`;
    await sql`insert into clinics(id, name, slug, created_by) values(${clinicId}, 'Plan Clinic', ${`plan-${suffix}`}, ${userId})`;
    await sql`insert into subscriptions(clinic_id, plan, status) values(${clinicId}, 'FREE', 'ACTIVE')`;
    await sql`insert into clinic_members(clinic_id, user_id, role, status) values(${clinicId}, ${userId}, 'CLINIC_OWNER', 'ACTIVE')`;
  });
  afterAll(async () => { await sql`delete from clinics where id = ${clinicId}`; await sql`delete from users where id = ${userId}`; await sql.end(); });

  it('rejects direct location inserts beyond the free-plan limit', async () => {
    await sql`insert into clinic_locations(clinic_id, name, timezone) values(${clinicId}, 'Main', 'UTC')`;
    await expect(sql`insert into clinic_locations(clinic_id, name, timezone) values(${clinicId}, 'Second', 'UTC')`).rejects.toMatchObject({ code: 'P0005' });
  });

  it('serializes concurrent inserts so limits cannot be raced', async () => {
    const insert = (name: string) => sql`insert into dentists(clinic_id, display_name) values(${clinicId}, ${name})`;
    const outcomes = await Promise.allSettled([insert('One'), insert('Two'), insert('Three'), insert('Four')]);
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(3);
    expect(outcomes.filter((outcome) => outcome.status === 'rejected')).toHaveLength(1);
  });
});
