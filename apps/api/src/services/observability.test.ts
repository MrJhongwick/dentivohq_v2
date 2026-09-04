import { describe, expect, it, vi } from 'vitest';
import { resolveRequestId, writeOperationalLog } from './observability';

describe('safe observability helpers', () => {
  it('accepts only bounded correlation identifiers', () => {
    expect(resolveRequestId('request_1234')).toBe('request_1234');
    expect(resolveRequestId('patient@example.com')).not.toBe('patient@example.com');
    expect(resolveRequestId('short')).not.toBe('short');
  });

  it('writes structured operational fields without arbitrary payloads', () => {
    const output = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    writeOperationalLog({ level: 'info', event: 'request.completed', component: 'api', requestId: 'request_1234', method: 'GET', path: '/health', status: 200, durationMs: 4 });
    expect(JSON.parse(String(output.mock.calls[0]?.[0]))).toMatchObject({ event: 'request.completed', component: 'api', path: '/health', status: 200 });
    output.mockRestore();
  });
});
