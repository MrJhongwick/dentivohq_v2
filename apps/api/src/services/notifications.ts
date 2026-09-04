import { claimNotificationJobs, completeNotificationJob, createDatabase, failNotificationJob } from '@dentivohq/db';
import type { ServerEnv } from '@dentivohq/config';
import { createEmailSender } from './email';
import { writeOperationalLog } from './observability';

export async function processNotificationJobs(env: ServerEnv) {
  const db = createDatabase(env.DATABASE_URL);
  const sendEmail = createEmailSender(env);
  const jobs = await claimNotificationJobs(db);
  let delivered = 0;
  let failed = 0;
  await Promise.all(jobs.map(async (job) => {
    try {
      await sendEmail({ to: String(job.recipient), subject: String(job.subject), text: String(job.body_text) }, { idempotencyKey: String(job.provider_key) });
      await completeNotificationJob(db, String(job.job_id), String(job.lease_token));
      delivered += 1;
    } catch {
      await failNotificationJob(db, String(job.job_id), String(job.lease_token), 'DELIVERY_FAILED');
      failed += 1;
    }
  }));
  const metrics = { claimed: jobs.length, delivered, failed };
  writeOperationalLog({ level: failed ? 'error' : 'info', event: 'notification.batch.completed', component: 'notification_queue', metrics });
  return metrics;
}
