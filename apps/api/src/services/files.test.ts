import { describe, expect, it } from 'vitest';
import { fileReconciliationAction } from './files';

describe('file reconciliation state machine', () => {
  it('recovers interrupted uploads', () => {
    expect(fileReconciliationAction('PENDING_UPLOAD', true)).toBe('ACTIVATE');
    expect(fileReconciliationAction('PENDING_UPLOAD', false)).toBe('ABANDON');
  });

  it('finishes deletion and removes dangling active metadata', () => {
    expect(fileReconciliationAction('DELETE_PENDING', true)).toBe('DELETE');
    expect(fileReconciliationAction('DELETE_PENDING', false)).toBe('DELETE');
    expect(fileReconciliationAction('ACTIVE', false)).toBe('REMOVE_MISSING');
    expect(fileReconciliationAction('ACTIVE', true)).toBe('NONE');
  });
});
