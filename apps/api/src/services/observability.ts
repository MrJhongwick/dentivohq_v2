import type { ServerEnv } from '@dentivohq/config';
import { checkDatabaseReadiness, getNotificationQueueMetrics, type Database } from '@dentivohq/db';

type ReadinessBindings = {
  UPLOADS?: Pick<R2Bucket, 'list'>;
  PUBLIC_BOOKING_RATE_LIMIT?: { limit(options: { key: string }): Promise<{ success: boolean }> };
};

export type OperationalLog = {
  level: 'info' | 'error';
  event: string;
  component: 'api' | 'database' | 'r2' | 'email' | 'notification_queue' | 'file_reconciliation';
  requestId?: string;
  method?: string;
  path?: string;
  status?: number;
  durationMs?: number;
  code?: string;
  metrics?: Record<string, number>;
};

export function writeOperationalLog(entry: OperationalLog) {
  const line = JSON.stringify({ timestamp: new Date().toISOString(), ...entry });
  if (entry.level === 'error') console.error(line);
  else console.log(line);
}

export function resolveRequestId(headerValue: string | undefined) {
  return headerValue && /^[A-Za-z0-9_-]{8,64}$/.test(headerValue) ? headerValue : crypto.randomUUID();
}

export async function inspectReadiness(db: Database, env: ServerEnv, bindings: ReadinessBindings) {
  const rateLimit = bindings.PUBLIC_BOOKING_RATE_LIMIT ? 'configured' : 'missing';
  const email = env.RESEND_API_KEY && env.RESEND_FROM_EMAIL ? 'configured' : 'missing';
  let database: string;
  let r2: string = bindings.UPLOADS ? 'unavailable' : 'missing';
  let queue = null;
  try {
    database = await checkDatabaseReadiness(db) ? 'ready' : 'unavailable';
    queue = database === 'ready' ? await getNotificationQueueMetrics(db) : null;
  } catch {
    database = 'unavailable';
  }
  if (bindings.UPLOADS) {
    try {
      await bindings.UPLOADS.list({ limit: 1 });
      r2 = 'ready';
    } catch {
      r2 = 'unavailable';
    }
  }

  const requiredReady = database === 'ready' && r2 === 'ready' && rateLimit === 'configured';
  return {
    status: requiredReady ? 'ready' : 'degraded',
    components: { database, r2, rateLimit, email, notificationQueue: database === 'ready' ? 'ready' : 'unavailable' },
    queue
  };
}
