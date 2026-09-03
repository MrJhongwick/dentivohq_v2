import { z } from 'zod';

export const uuidSchema = z.string().uuid();
export const idempotencyKeySchema = z.string().trim().min(8).max(128).regex(/^[A-Za-z0-9._:-]+$/);
export const fileOwnerTypeSchema = z.enum(['CLINIC_PATIENT', 'APPOINTMENT']);
export const clinicIdParamSchema = z.object({ clinicId: uuidSchema });
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});

export const appointmentStatusSchema = z.enum([
  'PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED'
]);

export const createAppointmentSchema = z.object({
  locationId: uuidSchema,
  dentistId: uuidSchema,
  clinicPatientId: uuidSchema,
  serviceId: uuidSchema,
  startsAt: z.iso.datetime({ offset: true }),
  notes: z.string().trim().max(1000).optional()
});

export const updateAppointmentStatusSchema = z.object({ status: appointmentStatusSchema });
export const rescheduleAppointmentSchema = z.object({
  startsAt: z.iso.datetime({ offset: true })
});

export const availabilityQuerySchema = z.object({
  locationId: uuidSchema,
  dentistId: uuidSchema,
  serviceId: uuidSchema,
  date: z.iso.date()
});

export const publicBookingSchema = z.object({
  locationId: uuidSchema,
  dentistId: uuidSchema,
  serviceId: uuidSchema,
  startsAt: z.iso.datetime({ offset: true }),
  patient: z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().toLowerCase().email().max(254),
    phone: z.string().trim().min(7).max(32)
  })
});

export const createClinicSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80)
});
export const createLocationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  timezone: z.string().trim().min(1).max(100),
  addressLine1: z.string().trim().max(200).optional(), city: z.string().trim().max(100).optional(),
  region: z.string().trim().max(100).optional(), postalCode: z.string().trim().max(20).optional(),
  countryCode: z.string().trim().toUpperCase().length(2).optional()
});
export const updateLocationSchema = createLocationSchema.partial().extend({ active: z.boolean().optional() }).refine((value) => Object.keys(value).length > 0, { message: 'At least one location field is required.' });
export const inviteStaffSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  role: z.enum(['CLINIC_ADMIN', 'RECEPTIONIST', 'DENTIST', 'DENTAL_ASSISTANT'])
});
export const createDentistSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  licenseNumber: z.string().trim().max(80).optional(),
  userId: z.string().min(1).optional()
});
export const createServiceSchema = z.object({
  name: z.string().trim().min(2).max(120), description: z.string().trim().max(1000).optional(),
  durationMinutes: z.number().int().min(5).max(480), priceMinor: z.number().int().min(0).optional(),
  currency: z.string().trim().toUpperCase().length(3).optional()
});
export const createScheduleSchema = z.object({
  dentistId: uuidSchema, locationId: uuidSchema, dayOfWeek: z.number().int().min(0).max(6),
  startsAtLocal: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), endsAtLocal: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  effectiveFrom: z.iso.date().optional(), effectiveTo: z.iso.date().optional()
}).refine((value) => value.startsAtLocal < value.endsAtLocal, { message: 'Schedule start must precede end.' });
export const createPatientSchema = z.object({
  displayName: z.string().trim().min(2).max(120), email: z.string().trim().toLowerCase().email().max(254).optional(),
  phone: z.string().trim().min(7).max(32).optional()
});
export const acceptInvitationSchema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) });
export const dentistAssignmentSchema = z.object({ dentistId: uuidSchema, locationId: uuidSchema.optional(), serviceId: uuidSchema.optional() });

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type AppointmentStatus = z.infer<typeof appointmentStatusSchema>;
export type RescheduleAppointmentInput = z.infer<typeof rescheduleAppointmentSchema>;
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;
export type PublicBookingInput = z.infer<typeof publicBookingSchema>;
export type CreateClinicInput = z.infer<typeof createClinicSchema>;
export type CreateLocationInput = z.infer<typeof createLocationSchema>;
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;
export type InviteStaffInput = z.infer<typeof inviteStaffSchema>;
export type CreateDentistInput = z.infer<typeof createDentistSchema>;
export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;
export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type FileOwnerType = z.infer<typeof fileOwnerTypeSchema>;
