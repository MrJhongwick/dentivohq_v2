# DentivoHQ preview environment

The preview environment is isolated from the default Worker and uses environment-provided URLs. Do not substitute a production custom domain until ownership is confirmed.

## One-time configuration

Create a GitHub environment named `preview`. Add these environment secrets:

- `CLOUDFLARE_API_TOKEN` with Workers, Pages, R2, and account-read permissions
- `CLOUDFLARE_ACCOUNT_ID`
- `PREVIEW_DATABASE_URL` using a dedicated Neon preview database/branch
- `PREVIEW_BETTER_AUTH_SECRET` with at least 32 random characters
- `PREVIEW_GOOGLE_CLIENT_ID` and `PREVIEW_GOOGLE_CLIENT_SECRET` when Google sign-in is enabled
- `PREVIEW_RESEND_API_KEY` when email delivery is enabled
- `PREVIEW_TURNSTILE_SECRET_KEY` using Cloudflare's always-pass test secret for preview automation
- `E2E_OWNER_EMAIL` and `E2E_OWNER_PASSWORD` for a verified, dedicated preview owner

Add these environment variables after selecting the available Cloudflare development subdomain:

- `PREVIEW_API_URL`
- `PREVIEW_DASHBOARD_URL`
- `PREVIEW_LANDING_URL`
- `PREVIEW_CONSOLE_URL`
- `PREVIEW_RESEND_FROM_EMAIL` when email is enabled
- `PREVIEW_TURNSTILE_SITE_KEY` using Cloudflare's matching always-pass visible test sitekey

The three Pages URLs must be listed in the Worker's `CORS_ORIGINS`; the workflow supplies them at deploy time. The dashboard proxies `/api/*` to the preview Worker through a Cloudflare service binding so Better Auth cookies remain first-party. Set the Google OAuth callback to `${PREVIEW_DASHBOARD_URL}/api/auth/callback/google` and allow `PREVIEW_DASHBOARD_URL` in the OAuth application. Never copy a production database or patient records into preview.

Use Cloudflare's documented Turnstile testing pair (`1x00000000000000000000AA` and `1x0000000000000000000000000000000AA`) in preview so Playwright receives a valid server-verified token without a real bot challenge. Never use these keys in production.

## Deployment and verification

Run the **Preview deployment** workflow from the commit to verify. It applies migrations, creates the isolated R2 bucket and Pages projects if needed, deploys the Worker and browser applications, and requires `/health` to report `ready`.

After deployment, the workflow runs the real API-backed end-to-end suite against the deployed dashboard and Worker. The dedicated identity must be verified; the journey creates a new isolated synthetic clinic on every run. Store test credentials only as GitHub environment secrets. Capture the workflow URL, deployed commit SHA, readiness response, OAuth result, and end-to-end result as the verification evidence.

## Teardown and rotation

Preview data is disposable. Rotate the Better Auth secret, provider credentials, and test identity after any suspected exposure. Remove preview objects before deleting their metadata, then delete the preview database branch only after confirming no production connection string points to it.
