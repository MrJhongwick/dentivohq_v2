import { roleHasPermission } from '@dentivohq/auth';
import { describe, expect, it } from 'vitest';
import { maximumPrivateFileBytes, privateFileHeaders, requirePrivateObject, validatePrivateUpload } from './private-files';

describe('private file route safeguards', () => {
  it('blocks unsupported MIME types and oversized bodies', () => {
    expect(() => validatePrivateUpload(new File(['script'], 'payload.svg', { type: 'image/svg+xml' }), 6)).toThrowError(expect.objectContaining({ code: 'FILE_TYPE_NOT_ALLOWED', status: 415 }));
    expect(() => validatePrivateUpload(new File(['ok'], 'scan.pdf', { type: 'application/pdf' }), maximumPrivateFileBytes + 1)).toThrowError(expect.objectContaining({ code: 'FILE_TOO_LARGE', status: 413 }));
  });

  it('returns a missing-file response when metadata outlives a deleted object', () => {
    expect(() => requirePrivateObject(null)).toThrowError(expect.objectContaining({ code: 'FILE_NOT_FOUND', status: 404 }));
  });

  it('forces private non-cacheable downloads', () => {
    expect(privateFileHeaders('application/pdf')).toEqual({ 'Content-Type': 'application/pdf', 'Cache-Control': 'private, no-store', 'Content-Disposition': 'attachment' });
  });

  it('does not grant file mutation to read-only clinic roles', () => {
    expect(roleHasPermission('DENTAL_ASSISTANT', 'patient.read')).toBe(true);
    expect(roleHasPermission('DENTAL_ASSISTANT', 'patient.update')).toBe(false);
  });
});
