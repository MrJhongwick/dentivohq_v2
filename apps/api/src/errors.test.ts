import { describe, expect, it } from 'vitest';
import { normalizeError } from './errors';

describe('API error normalization', () => {
  it('reports mismatched idempotency-key reuse without a misleading slot conflict', () => {
    expect(normalizeError({ code: 'P0004' })).toMatchObject({
      status: 409,
      code: 'IDEMPOTENCY_KEY_REUSED'
    });
  });

  it('returns an actionable conflict for a duplicate clinic slug', () => {
    const error = normalizeError({ code: '23505', constraint: 'clinics_slug_key' });

    expect(error.status).toBe(409);
    expect(error.code).toBe('CLINIC_SLUG_TAKEN');
    expect(error.message).toBe('That clinic URL is already in use. Choose another one.');
  });
});
