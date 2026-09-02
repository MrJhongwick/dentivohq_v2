export type ClinicRole = 'CLINIC_OWNER' | 'CLINIC_ADMIN' | 'RECEPTIONIST' | 'DENTIST' | 'DENTAL_ASSISTANT';
export type PlatformRole = 'PLATFORM_ADMIN';
export type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW' | 'RESCHEDULED';

export type ClinicMembership = {
  id: string;
  clinicId: string;
  userId: string;
  role: ClinicRole;
  status: 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'REMOVED';
};

export type AppointmentRecord = {
  id: string;
  clinicId: string;
  locationId: string;
  dentistId: string;
  clinicPatientId: string;
  serviceId: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  patientDisplayName: string;
  serviceName: string;
};
