import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from './client';
import { beginFileDeletion, finalizeFileDeletion, findFileMetadata } from './repositories';

const sql = postgres(process.env.TEST_DATABASE_URL!, { max: 1 });
const db = sql as unknown as Database;

describe('file owner tenant enforcement', () => {
  const suffix = randomUUID().slice(0, 8);
  const userId = `file-owner-user-${suffix}`;
  const clinicA = randomUUID();
  const clinicB = randomUUID();
  const profileId = randomUUID();
  const clinicPatientId = randomUUID();

  beforeAll(async () => {
    await sql`insert into users(id, name, email, email_verified) values(${userId}, 'File Owner User', ${`${suffix}@example.test`}, true)`;
    await sql`insert into clinics(id, name, slug, created_by) values
      (${clinicA}, 'File Clinic A', ${`file-a-${suffix}`}, ${userId}),
      (${clinicB}, 'File Clinic B', ${`file-b-${suffix}`}, ${userId})`;
    await sql`insert into patient_profiles(id, clinic_id, display_name, email)
      values(${profileId}, ${clinicA}, 'File Patient', ${`patient-${suffix}@example.test`})`;
    await sql`insert into clinic_patients(id, clinic_id, patient_profile_id)
      values(${clinicPatientId}, ${clinicA}, ${profileId})`;
  });

  afterAll(async () => {
    await sql`delete from clinics where id in (${clinicA}, ${clinicB})`;
    await sql`delete from users where id = ${userId}`;
    await sql.end();
  });

  it('recognizes only an owner in the active clinic', async () => {
    const [allowed] = await sql`select file_owner_belongs_to_clinic(${clinicA}, 'CLINIC_PATIENT', ${clinicPatientId}) as belongs`;
    const [wrongClinic] = await sql`select file_owner_belongs_to_clinic(${clinicB}, 'CLINIC_PATIENT', ${clinicPatientId}) as belongs`;
    const [missing] = await sql`select file_owner_belongs_to_clinic(${clinicA}, 'CLINIC_PATIENT', ${randomUUID()}) as belongs`;
    expect(allowed?.belongs).toBe(true);
    expect(wrongClinic?.belongs).toBe(false);
    expect(missing?.belongs).toBe(false);
  });

  it('rejects cross-clinic metadata even when the repository check is bypassed', async () => {
    await expect(sql`insert into file_objects(
      clinic_id, owner_type, owner_id, bucket, object_key, mime_type, size_bytes, created_by
    ) values(
      ${clinicB}, 'CLINIC_PATIENT', ${clinicPatientId}, 'test', ${`test/${randomUUID()}`}, 'application/pdf', 1, ${userId}
    )`).rejects.toMatchObject({ code: '23503' });
  });

  it('cannot retrieve another clinic file and removes deleted metadata', async () => {
    const fileId = randomUUID();
    await sql`insert into file_objects(id, clinic_id, owner_type, owner_id, bucket, object_key, mime_type, size_bytes, created_by, status)
      values(${fileId}, ${clinicA}, 'CLINIC_PATIENT', ${clinicPatientId}, 'test', ${`test/${fileId}`}, 'application/pdf', 1, ${userId}, 'ACTIVE')`;
    await expect(findFileMetadata(db, clinicB, fileId)).resolves.toBeNull();
    await expect(findFileMetadata(db, clinicA, fileId)).resolves.toMatchObject({ id: fileId });
    await beginFileDeletion(db, clinicA, fileId);
    await finalizeFileDeletion(db, clinicA, fileId, userId);
    await expect(findFileMetadata(db, clinicA, fileId)).resolves.toBeNull();
  });
});
