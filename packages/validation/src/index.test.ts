import { describe, expect, it } from 'vitest';
import { createAppointmentSchema, paginationSchema } from './index';

describe('shared validation', () => {
  it('rejects malformed appointment input', () => {
    expect(createAppointmentSchema.safeParse({ dentistId: 'not-a-uuid' }).success).toBe(false);
  });

  it('bounds pagination', () => {
    expect(paginationSchema.parse({ page: '2', pageSize: '100' })).toEqual({ page: 2, pageSize: 100 });
    expect(paginationSchema.safeParse({ pageSize: 101 }).success).toBe(false);
  });
});
