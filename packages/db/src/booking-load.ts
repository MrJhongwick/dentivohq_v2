import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import postgres from 'postgres';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required for the booking load drill.');

const bookingCount = Number(process.env.BOOKING_LOAD_COUNT ?? 50);
const maximumP95Ms = Number(process.env.BOOKING_LOAD_MAX_P95_MS ?? 2_000);
const minimumThroughput = Number(process.env.BOOKING_LOAD_MIN_REQUESTS_PER_SECOND ?? 5);
const sql = postgres(databaseUrl, { max: Math.min(bookingCount, 25) });
const suffix = randomUUID().slice(0, 8);
const userId = `load-user-${suffix}`;
const clinicId = randomUUID();
const locationId = randomUUID();
const dentistId = randomUUID();
const serviceId = randomUUID();
const clinicSlug = `load-${suffix}`;

try {
  await sql`insert into users(id, name, email, email_verified) values(${userId}, 'Load Test User', ${`load-${suffix}@example.test`}, true)`;
  await sql`insert into clinics(id, name, slug, created_by) values(${clinicId}, 'Load Test Clinic', ${clinicSlug}, ${userId})`;
  await sql`insert into clinic_members(clinic_id, user_id, role, status) values(${clinicId}, ${userId}, 'CLINIC_OWNER', 'ACTIVE')`;
  await sql`insert into clinic_locations(id, clinic_id, name, timezone) values(${locationId}, ${clinicId}, 'Load Test Location', 'UTC')`;
  await sql`insert into dentists(id, clinic_id, display_name) values(${dentistId}, ${clinicId}, 'Dr Load')`;
  await sql`insert into services(id, clinic_id, name, duration_minutes) values(${serviceId}, ${clinicId}, 'Load Test Service', 30)`;
  await sql`insert into dentist_location_assignments(clinic_id, dentist_id, location_id) values(${clinicId}, ${dentistId}, ${locationId})`;
  await sql`insert into dentist_services(clinic_id, dentist_id, service_id) values(${clinicId}, ${dentistId}, ${serviceId})`;

  const patientIds: string[] = [];
  for (let index = 0; index < bookingCount; index += 1) {
    const profileId = randomUUID();
    const patientId = randomUUID();
    await sql`insert into patient_profiles(id, clinic_id, display_name, email) values(${profileId}, ${clinicId}, ${`Load Patient ${index}`}, ${`load-patient-${suffix}-${index}@example.test`})`;
    await sql`insert into clinic_patients(id, clinic_id, patient_profile_id) values(${patientId}, ${clinicId}, ${profileId})`;
    patientIds.push(patientId);
  }

  const baseline = new Date();
  baseline.setUTCDate(baseline.getUTCDate() + 30);
  baseline.setUTCHours(10, 0, 0, 0);
  const effectiveTo = new Date(baseline);
  effectiveTo.setUTCDate(effectiveTo.getUTCDate() + bookingCount + 1);
  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek += 1) {
    await sql`insert into dentist_schedules(clinic_id, dentist_id, location_id, day_of_week, starts_at_local, ends_at_local, effective_from, effective_to)
      values(${clinicId}, ${dentistId}, ${locationId}, ${dayOfWeek}, '09:00', '17:00', ${baseline.toISOString().slice(0, 10)}, ${effectiveTo.toISOString().slice(0, 10)})`;
  }
  const timings: number[] = [];
  const startedAt = performance.now();
  await Promise.all(patientIds.map(async (patientId, index) => {
    const slot = new Date(baseline.getTime() + index * 24 * 60 * 60_000).toISOString();
    const requestStartedAt = performance.now();
    await sql`select * from book_clinic_appointment(${userId}, ${clinicId}, ${locationId}, ${dentistId}, ${patientId}, ${serviceId}, ${slot}, null)`;
    timings.push(performance.now() - requestStartedAt);
  }));
  const elapsedSeconds = (performance.now() - startedAt) / 1_000;
  const sorted = [...timings].sort((left, right) => left - right);
  const p95Ms = sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] ?? 0;
  const requestsPerSecond = bookingCount / elapsedSeconds;

  const collisionSlot = new Date(baseline.getTime() + bookingCount * 24 * 60 * 60_000).toISOString();
  const collisionResults = await Promise.allSettled(patientIds.slice(0, 10).map((patientId) =>
    sql`select * from book_clinic_appointment(${userId}, ${clinicId}, ${locationId}, ${dentistId}, ${patientId}, ${serviceId}, ${collisionSlot}, null)`
  ));
  const collisionSuccesses = collisionResults.filter((result) => result.status === 'fulfilled').length;

  console.log(JSON.stringify({ event: 'booking.load.completed', bookings: bookingCount, p95Ms: Math.round(p95Ms), requestsPerSecond: Number(requestsPerSecond.toFixed(1)), collisionAttempts: 10, collisionSuccesses }));
  if (p95Ms > maximumP95Ms) throw new Error(`Booking p95 ${p95Ms.toFixed(0)}ms exceeded ${maximumP95Ms}ms.`);
  if (requestsPerSecond < minimumThroughput) throw new Error(`Booking throughput ${requestsPerSecond.toFixed(1)}/s was below ${minimumThroughput}/s.`);
  if (collisionSuccesses !== 1) throw new Error(`Expected exactly one collision winner, received ${collisionSuccesses}.`);
} finally {
  await sql`delete from clinics where id = ${clinicId}`;
  await sql`delete from users where id = ${userId}`;
  await sql.end();
}
