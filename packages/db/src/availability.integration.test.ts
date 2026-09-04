import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const sql = postgres(process.env.TEST_DATABASE_URL!, { max: 2 });

describe.sequential('timezone-safe availability', () => {
  const suffix = randomUUID().slice(0, 8);
  const userId = `availability-user-${suffix}`;
  const clinicId = randomUUID();
  const dentistId = randomUUID();
  const serviceId = randomUUID();
  const newYorkId = randomUUID();
  const manilaId = randomUUID();

  beforeAll(async () => {
    await sql`insert into users(id, name, email, email_verified) values(${userId}, 'Availability User', ${`${suffix}@example.test`}, true)`;
    await sql`insert into clinics(id, name, slug, created_by) values(${clinicId}, 'Availability Clinic', ${`availability-${suffix}`}, ${userId})`;
    await sql`insert into subscriptions(clinic_id, plan, status) values(${clinicId}, 'STARTER', 'ACTIVE')`;
    await sql`insert into clinic_settings(clinic_id, slot_interval_minutes) values(${clinicId}, 30)`;
    await sql`insert into clinic_locations(id, clinic_id, name, timezone) values
      (${newYorkId}, ${clinicId}, 'New York', 'America/New_York'),
      (${manilaId}, ${clinicId}, 'Manila', 'Asia/Manila')`;
    await sql`insert into dentists(id, clinic_id, display_name) values(${dentistId}, ${clinicId}, 'Dr Time')`;
    await sql`insert into services(id, clinic_id, name, duration_minutes) values(${serviceId}, ${clinicId}, 'Boundary service', 30)`;
    await sql`insert into dentist_location_assignments(clinic_id, dentist_id, location_id) values
      (${clinicId}, ${dentistId}, ${newYorkId}), (${clinicId}, ${dentistId}, ${manilaId})`;
    await sql`insert into dentist_services(clinic_id, dentist_id, service_id) values(${clinicId}, ${dentistId}, ${serviceId})`;
  });

  afterAll(async () => {
    await sql`delete from clinics where id = ${clinicId}`;
    await sql`delete from users where id = ${userId}`;
    await sql.end();
  });

  it('produces unique real instants across both New York DST transitions', async () => {
    await sql`insert into dentist_schedules(clinic_id, dentist_id, location_id, day_of_week, starts_at_local, ends_at_local, effective_from, effective_to) values
      (${clinicId}, ${dentistId}, ${newYorkId}, 0, '01:00', '04:00', '2027-03-14', '2027-03-14'),
      (${clinicId}, ${dentistId}, ${newYorkId}, 0, '01:00', '04:00', '2027-03-14', '2027-03-14'),
      (${clinicId}, ${dentistId}, ${newYorkId}, 0, '00:30', '02:30', '2027-11-07', '2027-11-07')`;
    const spring = await sql`select * from get_available_slots(${clinicId}, ${newYorkId}, ${dentistId}, ${serviceId}, '2027-03-14')`;
    const fall = await sql`select * from get_available_slots(${clinicId}, ${newYorkId}, ${dentistId}, ${serviceId}, '2027-11-07')`;
    expect(spring).toHaveLength(4);
    expect(new Set(spring.map((slot) => new Date(slot.starts_at).toISOString())).size).toBe(spring.length);
    expect(fall).toHaveLength(6);
    expect(new Set(fall.map((slot) => new Date(slot.starts_at).toISOString())).size).toBe(fall.length);
  });

  it('honors effective bounds, partial exceptions, time off, and duration boundaries in Manila', async () => {
    await sql`insert into dentist_schedules(clinic_id, dentist_id, location_id, day_of_week, starts_at_local, ends_at_local, effective_from, effective_to)
      values(${clinicId}, ${dentistId}, ${manilaId}, 1, '09:00', '12:00', '2027-03-01', '2027-03-01')`;
    await sql`insert into dentist_schedule_exceptions(clinic_id, dentist_id, location_id, exception_date, unavailable, starts_at_local, ends_at_local)
      values(${clinicId}, ${dentistId}, ${manilaId}, '2027-03-01', true, '11:00', '11:30')`;
    await sql`insert into dentist_time_off(clinic_id, dentist_id, starts_at, ends_at)
      values(${clinicId}, ${dentistId}, '2027-03-01 10:00 Asia/Manila', '2027-03-01 10:30 Asia/Manila')`;
    const slots = await sql`select * from get_available_slots(${clinicId}, ${manilaId}, ${dentistId}, ${serviceId}, '2027-03-01')`;
    const localStarts = slots.map((slot) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(slot.starts_at)));
    expect(localStarts).toEqual(['09:00', '09:30', '10:30', '11:30']);
    expect(new Date(slots.at(-1)!.ends_at).toISOString()).toBe('2027-03-01T04:00:00.000Z');
    expect(await sql`select * from get_available_slots(${clinicId}, ${manilaId}, ${dentistId}, ${serviceId}, '2027-03-08')`).toHaveLength(0);
  });

  it('returns no slots for inactive dentists or services', async () => {
    await sql`update dentists set active = false where id = ${dentistId} and clinic_id = ${clinicId}`;
    expect(await sql`select * from get_available_slots(${clinicId}, ${newYorkId}, ${dentistId}, ${serviceId}, '2027-03-14')`).toHaveLength(0);
  });
});
