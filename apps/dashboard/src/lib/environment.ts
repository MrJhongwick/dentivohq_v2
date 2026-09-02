import { browserEnvSchema } from '@dentivohq/config';

export const environment = browserEnvSchema.parse({ apiUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:8787' });
