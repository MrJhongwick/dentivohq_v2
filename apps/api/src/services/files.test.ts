import { describe, expect, it } from 'vitest';
import { fileReconciliationAction, reconcileStorageOrphans } from './files';

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

  it('deletes every untracked R2 object across paginated listings', async () => {
    const deleted: string[] = [];
    const bucket = {
      list: async ({ cursor }: { cursor?: string }) => cursor
        ? { objects: [{ key: 'clinics/two/orphan' }], truncated: false }
        : { objects: [{ key: 'clinics/one/tracked' }, { key: 'clinics/one/orphan' }], truncated: true, cursor: 'next' },
      delete: async (key: string) => { deleted.push(key); }
    };
    const removed = await reconcileStorageOrphans(bucket as unknown as Pick<R2Bucket, 'list' | 'delete'>, async (key) => key.endsWith('/tracked') ? { id: 'tracked' } : null);
    expect(removed).toBe(2);
    expect(deleted).toEqual(['clinics/one/orphan', 'clinics/two/orphan']);
  });
});
