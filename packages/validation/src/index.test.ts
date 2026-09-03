import { describe, expect, it } from 'vitest';
import { createAppointmentSchema, fileOwnerTypeSchema, idempotencyKeySchema, paginationSchema } from './index';

describe('shared validation', () => {
  it('rejects malformed appointment input', () => {
    expect(createAppointmentSchema.safeParse({ dentistId: 'not-a-uuid' }).success).toBe(false);
  });

  it('bounds pagination', () => {
    expect(paginationSchema.parse({ page: '2', pageSize: '100' })).toEqual({ page: 2, pageSize: 100 });
    expect(paginationSchema.safeParse({ pageSize: 101 }).success).toBe(false);
  });

  it('accepts opaque idempotency keys with a bounded safe character set', () => {
    expect(idempotencyKeySchema.parse('booking:018f.test-key')).toBe('booking:018f.test-key');
    expect(idempotencyKeySchema.safeParse('short').success).toBe(false);
    expect(idempotencyKeySchema.safeParse('unsafe key').success).toBe(false);
  });

  it('rejects unsupported file owner types', () => {
    expect(fileOwnerTypeSchema.parse('CLINIC_PATIENT')).toBe('CLINIC_PATIENT');
    expect(fileOwnerTypeSchema.safeParse('patient').success).toBe(false);
    expect(fileOwnerTypeSchema.safeParse('invoice').success).toBe(false);
  });
});
