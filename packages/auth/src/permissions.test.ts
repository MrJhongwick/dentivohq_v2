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
});
