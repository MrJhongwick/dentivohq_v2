import { z } from 'zod';

const optionalSecret = z.string().trim().min(1).optional();

export const serverEnvSchema = z.object({
  APP_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  DATABASE_URL: z.string().url().refine((value) => value.startsWith('postgresql://') || value.startsWith('postgres://'), 'Must be a PostgreSQL URL'),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  APP_DASHBOARD_URL: z.string().url().default('http://localhost:5173'),
  GOOGLE_CLIENT_ID: optionalSecret,
  GOOGLE_CLIENT_SECRET: optionalSecret,
  RESEND_API_KEY: optionalSecret,
  RESEND_FROM_EMAIL: optionalSecret,
  TURNSTILE_SECRET_KEY: optionalSecret,
  CORS_ORIGINS: z.string().transform((value) => value.split(',').map((origin) => origin.trim()).filter(Boolean))
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(input: Record<string, unknown>): ServerEnv {
  return serverEnvSchema.parse(input);
}

export const browserEnvSchema = z.object({
  apiUrl: z.string().url(),
  dashboardUrl: z.string().url().optional(),
  turnstileSiteKey: optionalSecret
});

export type BrowserEnv = z.infer<typeof browserEnvSchema>;

export const planEntitlements = {
  FREE: { maxLocations: 1, maxDentists: 3, maxStaff: 5, smsEnabled: false, advancedReportsEnabled: false },
  STARTER: { maxLocations: 3, maxDentists: 10, maxStaff: 20, smsEnabled: false, advancedReportsEnabled: true }
} as const;
