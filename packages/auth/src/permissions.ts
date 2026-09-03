import { findActiveMembership, type AppointmentStatus, type ClinicMembership, type ClinicRole, type Database } from '@dentivohq/db';

export const permissions = [
  'appointment.read', 'appointment.create', 'appointment.update', 'appointment.cancel',
  'patient.read', 'patient.create', 'patient.update', 'billing.read', 'billing.manage',
  'staff.invite', 'staff.update', 'clinic.settings.update'
] as const;
export type Permission = (typeof permissions)[number];

const allPermissions = new Set<Permission>(permissions);
const rolePermissions: Record<ClinicRole, ReadonlySet<Permission>> = {
  CLINIC_OWNER: allPermissions,
  CLINIC_ADMIN: allPermissions,
  RECEPTIONIST: new Set(['appointment.read', 'appointment.create', 'appointment.update', 'appointment.cancel', 'patient.read', 'patient.create', 'patient.update']),
  DENTIST: new Set(['appointment.read', 'appointment.update', 'patient.read', 'patient.update']),
  DENTAL_ASSISTANT: new Set(['appointment.read', 'appointment.update', 'patient.read'])
};

export function roleHasPermission(role: ClinicRole, permission: Permission): boolean {
  return rolePermissions[role].has(permission);
}

export function permissionForAppointmentStatus(status: AppointmentStatus): Permission {
  return status === 'CANCELLED' ? 'appointment.cancel' : 'appointment.update';
}

export async function resolveAuthorizedMembership(db: Database, userId: string, clinicId: string, permission: Permission): Promise<ClinicMembership | null> {
  const membership = await findActiveMembership(db, userId, clinicId);
  return membership && roleHasPermission(membership.role, permission) ? membership : null;
}
