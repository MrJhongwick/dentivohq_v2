import { createAuth, permissionForAppointmentStatus, resolveAuthorizedMembership, type DentivoAuth, type Permission } from '@dentivohq/auth';
import { parseServerEnv, type ServerEnv } from '@dentivohq/config';
import {
  abandonFileMetadata, acceptStaffInvitation, activateFileMetadata, assignDentistLocation, assignDentistService, beginFileDeletion,
  createAppointment, createClinic, createDatabase, createDentist, createLocation, createPatient, createScheduleException, createTimeOff,
  createPublicAppointment, createSchedule, createService, createStaffInvitation, deleteSchedule, deleteScheduleException, deleteTimeOff, finalizeFileDeletion,
  fileOwnerBelongsToClinic, findFileMetadata, getClinicDashboardOverview, getPatient, getPlatformOverview, getPublicBookingConfig, listAppointments, listAvailability,
  listDentists, listLocations, listPatients, listSchedulingRules, listServices, listUserClinics, reserveFileMetadata, rescheduleAppointment, unassignDentistLocation, unassignDentistService, updateAppointmentStatus, updateDentist, updateLocation, updatePatient, updateSchedule, updateScheduleException, updateService, updateTimeOff, type Database
} from '@dentivohq/db';
import {
  acceptInvitationSchema, availabilityQuerySchema, clinicIdParamSchema, createAppointmentSchema, createClinicSchema, createDentistSchema,
  createLocationSchema, createPatientSchema, createScheduleExceptionSchema, createScheduleSchema, createServiceSchema, createTimeOffSchema, inviteStaffSchema,
  dentistAssignmentSchema, fileOwnerTypeSchema, idempotencyKeySchema, paginationSchema, patientListQuerySchema, publicBookingSchema, rescheduleAppointmentSchema, updateAppointmentStatusSchema, updateDentistSchema, updateLocationSchema, updatePatientSchema, updateScheduleExceptionSchema, updateScheduleSchema, updateServiceSchema, updateTimeOffSchema, uuidSchema
} from '@dentivohq/validation';
import { Hono, type Context, type MiddlewareHandler } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { AppError, normalizeError } from './errors';
import { createEmailSender } from './services/email';
import { reconcileFileStorage } from './services/files';
import { processNotificationJobs } from './services/notifications';

type AuthSession = Awaited<ReturnType<DentivoAuth['api']['getSession']>>;
type Variables = { runtime: ServerEnv; db: Database; auth: DentivoAuth; authSession: NonNullable<AuthSession> };
type AppBindings = {
  UPLOADS: R2Bucket;
  PUBLIC_BOOKING_RATE_LIMIT: {
    limit(options: { key: string }): Promise<{ success: boolean }>;
  };
  [key: string]: unknown;
};
type AppContext = Context<{ Bindings: AppBindings; Variables: Variables }>;
const app = new Hono<{ Bindings: AppBindings; Variables: Variables }>();

app.use('*', secureHeaders());
app.use('*', async (c, next) => {
  const runtime = parseServerEnv(c.env as unknown as Record<string, unknown>);
  c.set('runtime', runtime);
  c.set('db', createDatabase(runtime.DATABASE_URL));
  c.set('auth', createAuth(runtime, createEmailSender(runtime)));
  await next();
});
app.use('*', cors({
  origin: (origin, c) => c.get('runtime').CORS_ORIGINS.includes(origin) ? origin : '',
  credentials: true,
  allowHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS']
}));

const requireSession: MiddlewareHandler<{ Bindings: AppBindings; Variables: Variables }> = async (c, next) => {
  const session = await c.get('auth').api.getSession({ headers: c.req.raw.headers });
  if (!session) throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Sign in is required.');
  c.set('authSession', session);
  await next();
};

function requireClinicPermission(permission: Permission): MiddlewareHandler<{ Bindings: AppBindings; Variables: Variables }> {
  return async (c, next) => {
    const { clinicId } = clinicIdParamSchema.parse(c.req.param());
    const session = c.get('authSession');
    const membership = await resolveAuthorizedMembership(c.get('db'), session.user.id, clinicId, permission);
    if (!membership) throw new AppError(403, 'CLINIC_ACCESS_DENIED', 'You do not have access to this clinic.');
    await next();
  };
}

async function assertClinicPermission(c: AppContext, clinicId: string, permission: Permission) {
  const session = c.get('authSession');
  const membership = await resolveAuthorizedMembership(c.get('db'), session.user.id, clinicId, permission);
  if (!membership) throw new AppError(403, 'CLINIC_ACCESS_DENIED', 'You do not have access to this clinic.');
}

async function enforcePublicRateLimit(c: AppContext) {
  const key = `booking:${c.req.param('clinicSlug') ?? 'unknown'}`;
  const { success } = await c.env.PUBLIC_BOOKING_RATE_LIMIT.limit({ key });
  if (!success) throw new AppError(429, 'RATE_LIMITED', 'Too many booking requests. Please try again shortly.');
}

function getIdempotencyKey(c: AppContext) {
  return idempotencyKeySchema.parse(c.req.header('Idempotency-Key'));
}

app.get('/', (c) => c.json({ data: { name: 'DentivoHQ API', status: 'ok' } }));
app.get('/health', (c) => c.json({ data: { status: 'ok' } }));
app.all('/api/auth/*', (c) => c.get('auth').handler(c.req.raw));
app.get('/api/v1/auth/capabilities', (c) => c.json({ data: { google: Boolean(c.get('runtime').GOOGLE_CLIENT_ID && c.get('runtime').GOOGLE_CLIENT_SECRET) } }));

app.get('/api/v1/clinics', requireSession, async (c) => c.json({ data: await listUserClinics(c.get('db'), c.get('authSession').user.id) }));

app.post('/api/v1/clinics', requireSession, async (c) => {
  const session = c.get('authSession');
  if (!session.user.emailVerified) throw new AppError(403, 'EMAIL_VERIFICATION_REQUIRED', 'Verify your email before creating a clinic.');
  const clinic = await createClinic(c.get('db'), session.user.id, createClinicSchema.parse(await c.req.json()));
  return c.json({ data: clinic }, 201);
});

app.post('/api/v1/invitations/accept', requireSession, async (c) => {
  const { token } = acceptInvitationSchema.parse(await c.req.json());
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const tokenHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const session = c.get('authSession');
  const membership = await acceptStaffInvitation(c.get('db'), session.user.id, session.user.email, tokenHash);
  if (!membership) throw new AppError(404, 'INVITATION_NOT_FOUND', 'The invitation is invalid or expired.');
  return c.json({ data: membership });
});

app.post('/api/v1/clinics/:clinicId/locations', requireSession, requireClinicPermission('clinic.settings.update'), async (c) => {
  const { clinicId } = clinicIdParamSchema.parse(c.req.param());
  return c.json({ data: await createLocation(c.get('db'), clinicId, c.get('authSession').user.id, createLocationSchema.parse(await c.req.json())) }, 201);
});

app.get('/api/v1/clinics/:clinicId/locations', requireSession, requireClinicPermission('appointment.read'), async (c) => {
  const { clinicId } = clinicIdParamSchema.parse(c.req.param());
  return c.json({ data: await listLocations(c.get('db'), clinicId) });
});

app.patch('/api/v1/clinics/:clinicId/locations/:locationId', requireSession, requireClinicPermission('clinic.settings.update'), async (c) => {
  const { clinicId } = clinicIdParamSchema.parse(c.req.param());
  const location = await updateLocation(c.get('db'), clinicId, uuidSchema.parse(c.req.param('locationId')), c.get('authSession').user.id, updateLocationSchema.parse(await c.req.json()));
  if (!location) throw new AppError(404, 'LOCATION_NOT_FOUND', 'Location not found.');
  return c.json({ data: location });
});

app.post('/api/v1/clinics/:clinicId/invitations', requireSession, requireClinicPermission('staff.invite'), async (c) => {
  const { clinicId } = clinicIdParamSchema.parse(c.req.param());
  const input = inviteStaffSchema.parse(await c.req.json());
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = Array.from(tokenBytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  const tokenHashBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const tokenHash = Array.from(new Uint8Array(tokenHashBytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const invitation = await createStaffInvitation(c.get('db'), clinicId, c.get('authSession').user.id, input, tokenHash, expiresAt);
  const url = `${c.get('runtime').APP_DASHBOARD_URL}/accept-invitation?token=${encodeURIComponent(token)}`;
  c.executionCtx.waitUntil(createEmailSender(c.get('runtime'))({ to: input.email, subject: 'You are invited to DentivoHQ', text: `Accept your clinic invitation using this secure link: ${url}` }));
  return c.json({ data: invitation }, 201);
});

app.post('/api/v1/clinics/:clinicId/dentists', requireSession, requireClinicPermission('staff.update'), async (c) => {
  const { clinicId } = clinicIdParamSchema.parse(c.req.param());
  return c.json({ data: await createDentist(c.get('db'), clinicId, c.get('authSession').user.id, createDentistSchema.parse(await c.req.json())) }, 201);
});

app.get('/api/v1/clinics/:clinicId/dentists', requireSession, requireClinicPermission('appointment.read'), async (c) => {
  const { clinicId } = clinicIdParamSchema.parse(c.req.param());
  return c.json({ data: await listDentists(c.get('db'), clinicId) });
});

app.patch('/api/v1/clinics/:clinicId/dentists/:dentistId', requireSession, requireClinicPermission('staff.update'), async (c) => {
  const { clinicId } = clinicIdParamSchema.parse(c.req.param());
  const dentist = await updateDentist(c.get('db'), clinicId, uuidSchema.parse(c.req.param('dentistId')), c.get('authSession').user.id, updateDentistSchema.parse(await c.req.json()));
  if (!dentist) throw new AppError(404, 'DENTIST_NOT_FOUND', 'Dentist not found.');
  return c.json({ data: dentist });
});

app.post('/api/v1/clinics/:clinicId/dentist-locations', requireSession, requireClinicPermission('clinic.settings.update'), async (c) => {
  const { clinicId } = clinicIdParamSchema.parse(c.req.param());
  const input = dentistAssignmentSchema.required({ locationId: true }).parse(await c.req.json());
  return c.json({ data: await assignDentistLocation(c.get('db'), clinicId, input.dentistId, input.locationId) }, 201);
});

app.post('/api/v1/clinics/:clinicId/dentist-services', requireSession, requireClinicPermission('clinic.settings.update'), async (c) => {
  const { clinicId } = clinicIdParamSchema.parse(c.req.param());
  const input = dentistAssignmentSchema.required({ serviceId: true }).parse(await c.req.json());
  return c.json({ data: await assignDentistService(c.get('db'), clinicId, input.dentistId, input.serviceId) }, 201);
});

app.delete('/api/v1/clinics/:clinicId/dentist-locations/:dentistId/:locationId', requireSession, requireClinicPermission('clinic.settings.update'), async (c) => {
  const { clinicId } = clinicIdParamSchema.parse(c.req.param());
  await unassignDentistLocation(c.get('db'), clinicId, uuidSchema.parse(c.req.param('dentistId')), uuidSchema.parse(c.req.param('locationId')));
  return c.body(null, 204);
});

app.delete('/api/v1/clinics/:clinicId/dentist-services/:dentistId/:serviceId', requireSession, requireClinicPermission('clinic.settings.update'), async (c) => {
  const { clinicId } = clinicIdParamSchema.parse(c.req.param());
  await unassignDentistService(c.get('db'), clinicId, uuidSchema.parse(c.req.param('dentistId')), uuidSchema.parse(c.req.param('serviceId')));
  return c.body(null, 204);
});

app.post('/api/v1/clinics/:clinicId/services', requireSession, requireClinicPermission('clinic.settings.update'), async (c) => {
  const { clinicId } = clinicIdParamSchema.parse(c.req.param());
  return c.json({ data: await createService(c.get('db'), clinicId, c.get('authSession').user.id, createServiceSchema.parse(await c.req.json())) }, 201);
});

app.get('/api/v1/clinics/:clinicId/services', requireSession, requireClinicPermission('appointment.read'), async (c) => {
  const { clinicId } = clinicIdParamSchema.parse(c.req.param());
  return c.json({ data: await listServices(c.get('db'), clinicId) });
});

app.patch('/api/v1/clinics/:clinicId/services/:serviceId', requireSession, requireClinicPermission('clinic.settings.update'), async (c) => {
  const { clinicId } = clinicIdParamSchema.parse(c.req.param());
  const service = await updateService(c.get('db'), clinicId, uuidSchema.parse(c.req.param('serviceId')), c.get('authSession').user.id, updateServiceSchema.parse(await c.req.json()));
  if (!service) throw new AppError(404, 'SERVICE_NOT_FOUND', 'Service not found.');
  return c.json({ data: service });
});

app.post('/api/v1/clinics/:clinicId/schedules', requireSession, requireClinicPermission('clinic.settings.update'), async (c) => {
  const { clinicId } = clinicIdParamSchema.parse(c.req.param());
  return c.json({ data: await createSchedule(c.get('db'), clinicId, c.get('authSession').user.id, createScheduleSchema.parse(await c.req.json())) }, 201);
});

app.get('/api/v1/clinics/:clinicId/scheduling-rules', requireSession, requireClinicPermission('appointment.read'), async (c) => { const { clinicId } = clinicIdParamSchema.parse(c.req.param()); return c.json({ data: await listSchedulingRules(c.get('db'), clinicId) }); });
app.patch('/api/v1/clinics/:clinicId/schedules/:ruleId', requireSession, requireClinicPermission('clinic.settings.update'), async (c) => { const { clinicId } = clinicIdParamSchema.parse(c.req.param()); const data = await updateSchedule(c.get('db'), clinicId, uuidSchema.parse(c.req.param('ruleId')), updateScheduleSchema.parse(await c.req.json())); if (!data) throw new AppError(404, 'SCHEDULE_NOT_FOUND', 'Schedule not found.'); return c.json({ data }); });
app.delete('/api/v1/clinics/:clinicId/schedules/:ruleId', requireSession, requireClinicPermission('clinic.settings.update'), async (c) => { const { clinicId } = clinicIdParamSchema.parse(c.req.param()); await deleteSchedule(c.get('db'), clinicId, uuidSchema.parse(c.req.param('ruleId'))); return c.body(null, 204); });
app.post('/api/v1/clinics/:clinicId/schedule-exceptions', requireSession, requireClinicPermission('clinic.settings.update'), async (c) => { const { clinicId } = clinicIdParamSchema.parse(c.req.param()); return c.json({ data: await createScheduleException(c.get('db'), clinicId, createScheduleExceptionSchema.parse(await c.req.json())) }, 201); });
app.patch('/api/v1/clinics/:clinicId/schedule-exceptions/:ruleId', requireSession, requireClinicPermission('clinic.settings.update'), async (c) => { const { clinicId } = clinicIdParamSchema.parse(c.req.param()); const data = await updateScheduleException(c.get('db'), clinicId, uuidSchema.parse(c.req.param('ruleId')), updateScheduleExceptionSchema.parse(await c.req.json())); if (!data) throw new AppError(404, 'SCHEDULE_EXCEPTION_NOT_FOUND', 'Schedule exception not found.'); return c.json({ data }); });
app.delete('/api/v1/clinics/:clinicId/schedule-exceptions/:ruleId', requireSession, requireClinicPermission('clinic.settings.update'), async (c) => { const { clinicId } = clinicIdParamSchema.parse(c.req.param()); await deleteScheduleException(c.get('db'), clinicId, uuidSchema.parse(c.req.param('ruleId'))); return c.body(null, 204); });
app.post('/api/v1/clinics/:clinicId/time-off', requireSession, requireClinicPermission('clinic.settings.update'), async (c) => { const { clinicId } = clinicIdParamSchema.parse(c.req.param()); return c.json({ data: await createTimeOff(c.get('db'), clinicId, createTimeOffSchema.parse(await c.req.json())) }, 201); });
app.patch('/api/v1/clinics/:clinicId/time-off/:ruleId', requireSession, requireClinicPermission('clinic.settings.update'), async (c) => { const { clinicId } = clinicIdParamSchema.parse(c.req.param()); const data = await updateTimeOff(c.get('db'), clinicId, uuidSchema.parse(c.req.param('ruleId')), updateTimeOffSchema.parse(await c.req.json())); if (!data) throw new AppError(404, 'TIME_OFF_NOT_FOUND', 'Time off not found.'); return c.json({ data }); });
app.delete('/api/v1/clinics/:clinicId/time-off/:ruleId', requireSession, requireClinicPermission('clinic.settings.update'), async (c) => { const { clinicId } = clinicIdParamSchema.parse(c.req.param()); await deleteTimeOff(c.get('db'), clinicId, uuidSchema.parse(c.req.param('ruleId'))); return c.body(null, 204); });

app.post('/api/v1/clinics/:clinicId/patients', requireSession, requireClinicPermission('patient.create'), async (c) => {
  const { clinicId } = clinicIdParamSchema.parse(c.req.param());
  return c.json({ data: await createPatient(c.get('db'), clinicId, c.get('authSession').user.id, createPatientSchema.parse(await c.req.json())) }, 201);
});

app.get('/api/v1/clinics/:clinicId/patients', requireSession, requireClinicPermission('patient.read'), async (c) => { const { clinicId } = clinicIdParamSchema.parse(c.req.param()); const { page, pageSize, query } = patientListQuerySchema.parse(c.req.query()); const result = await listPatients(c.get('db'), clinicId, query, page, pageSize); return c.json({ data: result.data, meta: { page, pageSize, total: result.total } }); });
app.get('/api/v1/clinics/:clinicId/patients/:patientId', requireSession, requireClinicPermission('patient.read'), async (c) => { const { clinicId } = clinicIdParamSchema.parse(c.req.param()); const data = await getPatient(c.get('db'), clinicId, uuidSchema.parse(c.req.param('patientId'))); if (!data) throw new AppError(404, 'PATIENT_NOT_FOUND', 'Patient not found.'); return c.json({ data }); });
app.patch('/api/v1/clinics/:clinicId/patients/:patientId', requireSession, requireClinicPermission('patient.update'), async (c) => { const { clinicId } = clinicIdParamSchema.parse(c.req.param()); const data = await updatePatient(c.get('db'), clinicId, uuidSchema.parse(c.req.param('patientId')), c.get('authSession').user.id, updatePatientSchema.parse(await c.req.json())); if (!data) throw new AppError(404, 'PATIENT_NOT_FOUND', 'Patient not found.'); return c.json({ data }); });

app.get('/api/v1/clinics/:clinicId/appointments', requireSession, requireClinicPermission('appointment.read'), async (c) => {
  const { clinicId } = clinicIdParamSchema.parse(c.req.param());
  const { page, pageSize } = paginationSchema.parse(c.req.query());
  const result = await listAppointments(c.get('db'), clinicId, page, pageSize);
  return c.json({ data: result.data, meta: { page, pageSize, total: result.total } });
});

app.get('/api/v1/clinics/:clinicId/dashboard', requireSession, requireClinicPermission('appointment.read'), async (c) => {
  const { clinicId } = clinicIdParamSchema.parse(c.req.param());
  return c.json({ data: await getClinicDashboardOverview(c.get('db'), clinicId) });
});

app.post('/api/v1/clinics/:clinicId/appointments', requireSession, requireClinicPermission('appointment.create'), async (c) => {
  const { clinicId } = clinicIdParamSchema.parse(c.req.param());
  const body = createAppointmentSchema.parse(await c.req.json());
  return c.json({ data: await createAppointment(c.get('db'), c.get('authSession').user.id, clinicId, body, getIdempotencyKey(c)) }, 201);
});

app.get('/api/v1/clinics/:clinicId/availability', requireSession, requireClinicPermission('appointment.read'), async (c) => {
  const { clinicId } = clinicIdParamSchema.parse(c.req.param());
  return c.json({ data: await listAvailability(c.get('db'), clinicId, availabilityQuerySchema.parse(c.req.query())) });
});

app.patch('/api/v1/clinics/:clinicId/appointments/:appointmentId/status', requireSession, async (c) => {
  const { clinicId } = clinicIdParamSchema.parse(c.req.param());
  const appointmentId = uuidSchema.parse(c.req.param('appointmentId'));
  const body = updateAppointmentStatusSchema.parse(await c.req.json());
  await assertClinicPermission(c, clinicId, permissionForAppointmentStatus(body.status));
  const appointment = await updateAppointmentStatus(c.get('db'), c.get('authSession').user.id, clinicId, appointmentId, body.status);
  if (!appointment) throw new AppError(404, 'APPOINTMENT_NOT_FOUND', 'Appointment not found.');
  return c.json({ data: appointment });
});

app.post('/api/v1/clinics/:clinicId/appointments/:appointmentId/reschedule', requireSession, requireClinicPermission('appointment.update'), async (c) => {
  const { clinicId } = clinicIdParamSchema.parse(c.req.param());
  const appointmentId = uuidSchema.parse(c.req.param('appointmentId'));
  const body = rescheduleAppointmentSchema.parse(await c.req.json());
  const appointment = await rescheduleAppointment(c.get('db'), c.get('authSession').user.id, clinicId, appointmentId, body, getIdempotencyKey(c));
  if (!appointment) throw new AppError(404, 'APPOINTMENT_NOT_FOUND', 'Appointment not found.');
  return c.json({ data: appointment }, 201);
});

app.get('/api/v1/public/clinics/:clinicSlug/booking-config', async (c) => {
  const result = await getPublicBookingConfig(c.get('db'), c.req.param('clinicSlug'));
  if (!result) throw new AppError(404, 'CLINIC_NOT_FOUND', 'Clinic not found.');
  return c.json({ data: result });
});

app.get('/api/v1/public/clinics/:clinicSlug/availability', async (c) => {
  const config = await getPublicBookingConfig(c.get('db'), c.req.param('clinicSlug'));
  if (!config) throw new AppError(404, 'CLINIC_NOT_FOUND', 'Clinic not found.');
  const query = availabilityQuerySchema.parse(c.req.query());
  return c.json({ data: await listAvailability(c.get('db'), String(config.clinic.id), query) });
});

app.post('/api/v1/public/clinics/:clinicSlug/appointments', async (c) => {
  await enforcePublicRateLimit(c);
  const appointment = await createPublicAppointment(c.get('db'), c.req.param('clinicSlug'), publicBookingSchema.parse(await c.req.json()), getIdempotencyKey(c));
  return c.json({ data: { id: appointment.id, startsAt: appointment.startsAt, endsAt: appointment.endsAt, status: appointment.status } }, 201);
});

app.post('/api/v1/clinics/:clinicId/files', requireSession, requireClinicPermission('patient.update'), async (c) => {
  const { clinicId } = clinicIdParamSchema.parse(c.req.param());
  if (Number(c.req.header('content-length') ?? 0) > 10 * 1024 * 1024) throw new AppError(413, 'FILE_TOO_LARGE', 'Files must not exceed 10 MB.');
  const body = await c.req.parseBody();
  const file = body.file;
  const ownerId = uuidSchema.parse(body.ownerId);
  const ownerType = fileOwnerTypeSchema.parse(body.ownerType);
  if (!(file instanceof File)) throw new AppError(400, 'FILE_REQUIRED', 'A file is required.');
  if (file.size > 10 * 1024 * 1024) throw new AppError(413, 'FILE_TOO_LARGE', 'Files must not exceed 10 MB.');
  if (!new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']).has(file.type)) throw new AppError(415, 'FILE_TYPE_NOT_ALLOWED', 'This file type is not allowed.');
  if (!await fileOwnerBelongsToClinic(c.get('db'), clinicId, ownerType, ownerId)) {
    throw new AppError(404, 'FILE_OWNER_NOT_FOUND', 'The file owner was not found in this clinic.');
  }
  const fileId = crypto.randomUUID();
  const objectKey = `clinics/${clinicId}/${ownerType.toLowerCase()}/${ownerId}/${fileId}`;
  const pending = await reserveFileMetadata(c.get('db'), { clinicId, ownerId, ownerType, objectKey, bucket: 'UPLOADS', mimeType: file.type, sizeBytes: file.size, createdBy: c.get('authSession').user.id });
  if (!pending) throw new AppError(500, 'FILE_RESERVATION_FAILED', 'The file upload could not be started.');
  try {
    await c.env.UPLOADS.put(objectKey, file.stream(), { httpMetadata: { contentType: file.type }, customMetadata: { clinicId, fileId } });
  } catch (error) {
    await abandonFileMetadata(c.get('db'), clinicId, String(pending.id)).catch(() => undefined);
    throw error;
  }
  const metadata = await activateFileMetadata(c.get('db'), clinicId, String(pending.id));
  if (!metadata) throw new AppError(500, 'FILE_ACTIVATION_FAILED', 'The file upload could not be completed.');
  return c.json({ data: metadata }, 201);
});

app.get('/api/v1/clinics/:clinicId/files/:fileId', requireSession, requireClinicPermission('patient.read'), async (c) => {
  const { clinicId } = clinicIdParamSchema.parse(c.req.param());
  const metadata = await findFileMetadata(c.get('db'), clinicId, uuidSchema.parse(c.req.param('fileId')));
  if (!metadata) throw new AppError(404, 'FILE_NOT_FOUND', 'File not found.');
  const object = await c.env.UPLOADS.get(String(metadata.object_key));
  if (!object) throw new AppError(404, 'FILE_NOT_FOUND', 'File not found.');
  return new Response(object.body, { headers: { 'Content-Type': String(metadata.mime_type), 'Cache-Control': 'private, no-store', 'Content-Disposition': 'attachment' } });
});

app.delete('/api/v1/clinics/:clinicId/files/:fileId', requireSession, requireClinicPermission('patient.update'), async (c) => {
  const { clinicId } = clinicIdParamSchema.parse(c.req.param());
  const fileId = uuidSchema.parse(c.req.param('fileId'));
  const metadata = await beginFileDeletion(c.get('db'), clinicId, fileId);
  if (!metadata) return c.body(null, 204);
  await c.env.UPLOADS.delete(String(metadata.object_key));
  await finalizeFileDeletion(c.get('db'), clinicId, fileId, c.get('authSession').user.id);
  return c.body(null, 204);
});

app.get('/api/v1/platform/overview', requireSession, async (c) => {
  const overview = await getPlatformOverview(c.get('db'), c.get('authSession').user.id);
  if (!overview) throw new AppError(403, 'PLATFORM_ADMIN_REQUIRED', 'Platform administrator access is required.');
  return c.json({ data: overview });
});

app.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: 'Route not found.' } }, 404));
app.onError((error, c) => {
  const normalized = normalizeError(error);
  if (normalized.status === 500) console.error(JSON.stringify({ level: 'error', code: normalized.code, path: c.req.path }));
  return c.json({ error: { code: normalized.code, message: normalized.message } }, normalized.status);
});

export default {
  fetch(request, env, context) {
    return app.fetch(request, env, context);
  },
  scheduled(_controller, env, context) {
    const runtime = parseServerEnv(env as unknown as Record<string, unknown>);
    context.waitUntil(Promise.all([
      processNotificationJobs(runtime),
      reconcileFileStorage(createDatabase(runtime.DATABASE_URL), env.UPLOADS)
    ]).then(() => undefined));
  }
} satisfies ExportedHandler<AppBindings>;
