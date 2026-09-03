import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const sql = postgres(process.env.TEST_DATABASE_URL!, { max: 1 });

describe('append-only audit logs', () => {
  const suffix = randomUUID().slice(0, 8);
  const userId = `audit-user-${suffix}`;
  const clinicId = randomUUID();
  let auditId = '';

  beforeAll(async () => {
    await sql`insert into users(id, name, email, email_verified) values(${userId}, 'Audit User', ${`${suffix}@example.test`}, true)`;
    await sql`insert into clinics(id, name, slug, created_by) values(${clinicId}, 'Audit Clinic', ${`audit-${suffix}`}, ${userId})`;
    const rows = await sql`insert into audit_logs(clinic_id, actor_user_id, action, resource_type, resource_id, metadata)
      values(${clinicId}, ${userId}, 'PATIENT_RECORD_VIEWED', 'clinic_patient', ${randomUUID()}, ${JSON.stringify({ source: 'test', filtered: true })}::text::jsonb) returning id`;
    auditId = String(rows[0]!.id);
  });

  afterAll(async () => { await sql`delete from clinics where id = ${clinicId}`; await sql`delete from users where id = ${userId}`; await sql.end(); });

  it('stores allowlisted metadata without patient identity fields', async () => {
    const rows = await sql`select metadata from audit_logs where id = ${auditId}`;
    expect(rows[0]!.metadata).toEqual({ source: 'test', filtered: true });
    expect(JSON.stringify(rows[0]!.metadata)).not.toMatch(/name|email|phone|notes/i);
  });

  it('rejects direct updates and deletes', async () => {
    await expect(sql`update audit_logs set action = 'TAMPERED' where id = ${auditId}`).rejects.toMatchObject({ code: '42501' });
    await expect(sql`delete from audit_logs where id = ${auditId}`).rejects.toMatchObject({ code: '42501' });
  });
});
