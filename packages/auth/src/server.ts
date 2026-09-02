import { neon } from '@neondatabase/serverless';
import { betterAuth } from 'better-auth';
import type { ServerEnv } from '@dentivohq/config';
import { NeonDialect } from 'kysely-neon';

export type AuthEmail = { to: string; subject: string; text: string };
export type SendAuthEmail = (email: AuthEmail) => Promise<void>;

export function createAuth(env: ServerEnv, sendEmail: SendAuthEmail) {
  const socialProviders = env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
    : undefined;

  return betterAuth({
    appName: 'DentivoHQ',
    baseURL: env.BETTER_AUTH_URL,
    basePath: '/api/auth',
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: env.CORS_ORIGINS,
    database: {
      dialect: new NeonDialect({ neon: neon(env.DATABASE_URL) }),
      type: 'postgres',
      casing: 'snake'
    },
    user: {
      modelName: 'users',
      additionalFields: {
        platformRole: { type: 'string', required: false, input: false, fieldName: 'platform_role' }
      }
    },
    session: { modelName: 'auth_sessions', expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
    account: { modelName: 'auth_accounts' },
    verification: { modelName: 'auth_verifications' },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      sendResetPassword: async ({ user, url }) => sendEmail({
        to: user.email,
        subject: 'Reset your DentivoHQ password',
        text: `Reset your DentivoHQ password using this secure link: ${url}`
      })
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => sendEmail({
        to: user.email,
        subject: 'Verify your DentivoHQ email',
        text: `Verify your email address to continue with DentivoHQ: ${url}`
      })
    },
    ...(socialProviders ? { socialProviders } : {}),
    advanced: { database: { generateId: 'uuid', defaultFindManyLimit: 100, joins: true } }
  });
}

export type DentivoAuth = ReturnType<typeof createAuth>;
