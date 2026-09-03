import { describe, expect, it } from 'vitest';
import { normalizeError } from './errors';

describe('API error normalization', () => {
  it('reports mismatched idempotency-key reuse without a misleading slot conflict', () => {
    expect(normalizeError({ code: 'P0004' })).toMatchObject({
      status: 409,
      code: 'IDEMPOTENCY_KEY_REUSED'
    });
  });
});
