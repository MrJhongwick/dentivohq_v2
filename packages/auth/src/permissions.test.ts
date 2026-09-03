import { describe, expect, it } from 'vitest';
import { permissionForAppointmentStatus, roleHasPermission } from './permissions';

describe('clinic permissions', () => {
  it('allows owners to manage billing and staff', () => {
    expect(roleHasPermission('CLINIC_OWNER', 'billing.manage')).toBe(true);
    expect(roleHasPermission('CLINIC_OWNER', 'staff.invite')).toBe(true);
  });

  it('does not allow receptionists to manage billing or staff', () => {
    expect(roleHasPermission('RECEPTIONIST', 'billing.manage')).toBe(false);
    expect(roleHasPermission('RECEPTIONIST', 'staff.invite')).toBe(false);
  });

  it('keeps assistants read-oriented', () => {
    expect(roleHasPermission('DENTAL_ASSISTANT', 'patient.read')).toBe(true);
    expect(roleHasPermission('DENTAL_ASSISTANT', 'patient.update')).toBe(false);
  });

  it('requires the cancellation permission for a cancelled status', () => {
    expect(roleHasPermission('DENTIST', 'appointment.update')).toBe(true);
    expect(roleHasPermission('DENTIST', 'appointment.cancel')).toBe(false);
    expect(permissionForAppointmentStatus('CONFIRMED')).toBe('appointment.update');
    expect(permissionForAppointmentStatus('CANCELLED')).toBe('appointment.cancel');
  });

  it.each([
    ['CLINIC_OWNER', 'clinic.settings.update', true],
    ['CLINIC_ADMIN', 'staff.update', true],
    ['RECEPTIONIST', 'appointment.create', true],
    ['RECEPTIONIST', 'clinic.settings.update', false],
    ['DENTIST', 'patient.create', false],
    ['DENTAL_ASSISTANT', 'appointment.cancel', false]
  ] as const)('%s access to %s is %s', (role, permission, expected) => {
    expect(roleHasPermission(role, permission)).toBe(expected);
  });
});
