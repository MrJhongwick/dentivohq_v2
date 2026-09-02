import { createAuthClient } from 'better-auth/react';
import { environment } from './environment';

export const authClient = createAuthClient({ baseURL: environment.apiUrl, basePath: '/api/auth' });
