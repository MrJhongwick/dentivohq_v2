import { claimNotificationJobs, completeNotificationJob, createDatabase, failNotificationJob } from '@dentivohq/db';
import type { ServerEnv } from '@dentivohq/config';
import { createEmailSender } from './email';

export async function processNotificationJobs(env: ServerEnv) {
  const db = createDatabase(env.DATABASE_URL);
  const sendEmail = createEmailSender(env);
  const jobs = await claimNotificationJobs(db);
  await Promise.all(jobs.map(async (job) => {
    try {
      await sendEmail({ to: String(job.recipient), subject: String(job.subject), text: String(job.body_text) });
      await completeNotificationJob(db, String(job.job_id));
    } catch {
      await failNotificationJob(db, String(job.job_id), 'DELIVERY_FAILED');
    }
  }));
}
