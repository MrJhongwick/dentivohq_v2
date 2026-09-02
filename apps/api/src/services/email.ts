import type { AuthEmail } from '@dentivohq/auth';
import type { ServerEnv } from '@dentivohq/config';
import { Resend } from 'resend';

export function createEmailSender(env: ServerEnv) {
  return async ({ to, subject, text }: AuthEmail) => {
    if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) throw new Error('Email delivery is not configured.');
    const result = await new Resend(env.RESEND_API_KEY).emails.send({ from: env.RESEND_FROM_EMAIL, to, subject, text });
    if (result.error) throw new Error(`Email provider rejected the request: ${result.error.name}`);
  };
}
