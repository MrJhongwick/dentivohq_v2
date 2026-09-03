import { browserEnvSchema } from '@dentivohq/config';

export const environment = browserEnvSchema.parse({ apiUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:8787', turnstileSiteKey: import.meta.env.VITE_TURNSTILE_SITE_KEY || undefined });
