# AGENTS.md

## Project Brand

**DentivoHQ** is the canonical project and product name for this repository.

Use `DentivoHQ` consistently in product-facing copy, documentation, examples, UI labels, metadata, and internal project references unless a specific technical identifier requires another format.

Current brand status:

```text
Product name: DentivoHQ
Domain: not registered yet
Domain decision: revisit before production deployment
```

Do not assume ownership of `dentivohq.com` or hardcode that domain into production-sensitive logic until the project owner confirms domain registration.

For local development and preview environments, use environment-based URLs and Cloudflare-provided development domains.

---

## Purpose

This repository contains **DentivoHQ**, a multi-tenant SaaS dental appointment platform.

This file defines the technical standards, architecture rules, implementation constraints, and working conventions that AI coding agents must follow when modifying this project.

The codebase should remain secure, maintainable, free-tier friendly during MVP development, portable across environments, consistent across all apps, and scalable without premature infrastructure complexity.

---

## 1. Product Context

**DentivoHQ** is a SaaS dental appointment platform where multiple dental clinics can register and use the system independently.

Each clinic is a tenant.

Core capabilities include clinic registration, multiple locations, staff and roles, dentists, patients, services, schedules, appointments, reminders, subscriptions, file uploads, audit logs, and future support for payments, clinical records, analytics, and enterprise features.

Tenant isolation and authorization are mandatory architectural requirements.

---

## 2. Approved Stack

### Monorepo

- pnpm workspaces

### Landing

- Astro
- Cloudflare Pages

### API

- Hono
- TypeScript
- Cloudflare Workers

### Dashboard

- Vite
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Cloudflare Pages

### Console

- Vite
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Cloudflare Pages

### Database

- PostgreSQL
- Neon Free Tier for MVP

### Authentication

- Better Auth
- Google OAuth

### Email

- Resend Free Tier

### File Storage

- Cloudflare R2 Free Tier

### Infrastructure

- Cloudflare
- Docker
- GitHub
- GitHub Actions

### Validation

- Zod

### Testing

- Vitest
- Playwright

---

## 3. Monorepo Structure

Preferred structure:

```text
/
├── apps/
│   ├── landing/
│   ├── api/
│   ├── dashboard/
│   └── console/
├── packages/
│   ├── db/
│   ├── auth/
│   ├── ui/
│   ├── validation/
│   ├── config/
│   ├── types/
│   └── utils/
├── tooling/
├── docker/
├── .github/
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.json
└── AGENTS.md
```

Do not create new top-level folders without a clear architectural reason.

---

## 4. App Responsibilities

### `apps/landing`

Use Astro.

Purpose:

- DentivoHQ marketing website
- SEO pages
- Pricing
- Features
- Public documentation entry points
- Legal pages
- Conversion-focused content

Keep this app mostly static.

Deploy to Cloudflare Pages.

### `apps/api`

Use Hono + TypeScript.

Purpose:

- DentivoHQ public and internal API
- Authentication callbacks
- Business logic
- Clinic operations
- Appointment operations
- Patient operations
- Staff operations
- File metadata
- Webhooks
- Background-compatible endpoints

Deploy to Cloudflare Workers.

The API must be compatible with the Workers runtime.

Avoid:

- Local filesystem assumptions
- Long-running server processes
- Node-only native modules
- Persistent in-memory state

### `apps/dashboard`

Use Vite + React + TypeScript + Tailwind CSS + shadcn/ui.

Purpose:

- DentivoHQ clinic owner dashboard
- Admin dashboard
- Receptionist workflows
- Dentist workflows
- Dental assistant workflows

Primary areas:

- Appointments
- Locations
- Dentists
- Staff
- Patients
- Services
- Schedules
- Reports
- Billing
- Notifications

Deploy to Cloudflare Pages.

### `apps/console`

Use Vite + React + TypeScript + Tailwind CSS + shadcn/ui.

Purpose:

- Internal DentivoHQ platform administration only

Users:

- `PLATFORM_ADMIN`

Primary areas:

- Clinic management
- SaaS account management
- Subscription oversight
- Audit inspection
- Support tooling
- Platform configuration

Do not mix platform-admin functionality into the clinic dashboard.

---

## 5. Shared Packages

### `packages/db`

Owns:

- Database schema
- SQL migrations
- Query helpers
- Database types
- Repository functions

Database:

- PostgreSQL

Initial hosted provider:

- Neon

Keep database code portable to standard PostgreSQL.

### `packages/auth`

Use Better Auth.

Owns:

- Auth configuration
- Session handling
- Google OAuth
- Role resolution
- Clinic membership resolution
- Authorization helpers

Never trust role or tenant data from the client.

### `packages/ui`

Shared React UI components for dashboard and console.

Use:

- Tailwind CSS
- shadcn/ui

Do not duplicate common components across apps.

### `packages/validation`

Use Zod.

Owns:

- API schemas
- Form schemas
- Environment validation
- Shared domain validation

### `packages/config`

Owns:

- Environment schema
- Feature flags
- Shared constants
- Plan definitions
- Application URLs

### `packages/types`

Use only for domain types that are not better inferred from Zod or database schemas.

### `packages/utils`

Generic utilities only.

Do not place domain-specific business logic in generic utility folders.

---

## 6. Multi-Tenant Architecture

Core rule:

```text
clinic = tenant
```

Every tenant-owned resource must belong to a clinic.

Most tenant-owned tables should include:

```text
clinic_id UUID NOT NULL
```

Examples:

- appointments
- services
- clinic_locations
- dentists
- clinic_patients
- invoices
- payments
- notifications
- audit_logs

Never fetch tenant-owned data using only a resource ID.

Bad:

```ts
getAppointment(appointmentId);
```

Preferred:

```ts
getAppointment({
  clinicId,
  appointmentId,
});
```

All tenant-sensitive operations must validate clinic membership.

---

## 7. Core Database Tables

Expected foundational tables:

```text
users

clinics
clinic_members
clinic_locations
clinic_settings
clinic_invitations

dentists
dentist_location_assignments
dentist_services
dentist_schedules
dentist_schedule_exceptions
dentist_time_off

patient_profiles
clinic_patients

services

appointments
appointment_status_history

subscriptions

notification_templates
notification_preferences
notification_jobs
notification_deliveries

file_objects

audit_logs
webhook_events
```

Future tables may include:

```text
medical_histories
patient_documents
patient_consents
treatment_records
invoices
invoice_items
payments
refunds
appointment_resources
```

---

## 8. Membership Model

Do not place one global clinic role directly on the user.

Bad:

```text
users.role
```

Use:

```text
clinic_members
```

Recommended fields:

```text
id
clinic_id
user_id
role
status
created_at
updated_at
```

One user may belong to multiple clinics with different roles.

---

## 9. Roles

Platform:

- `PLATFORM_ADMIN`

Clinic:

- `CLINIC_OWNER`
- `CLINIC_ADMIN`
- `RECEPTIONIST`
- `DENTIST`
- `DENTAL_ASSISTANT`

Patient:

- `PATIENT`

As the application grows, prefer granular permissions over scattered role comparisons.

Example permissions:

```text
appointment.read
appointment.create
appointment.update
appointment.cancel

patient.read
patient.create
patient.update

billing.read
billing.manage

staff.invite
staff.update

clinic.settings.update
```

---

## 10. Authorization

Every protected request should follow:

```text
Request
  ↓
Authentication
  ↓
Resolve user
  ↓
Resolve clinic context
  ↓
Verify clinic membership
  ↓
Verify role / permission
  ↓
Validate input
  ↓
Validate business rules
  ↓
Execute database operation
```

Never rely on frontend visibility for security.

Hiding a button is not authorization.

All authorization must exist on the server.

---

## 11. Authentication

Use Better Auth.

Supported methods:

- Email/password
- Google OAuth

Authentication should support:

- Registration
- Login
- Logout
- Password reset
- Email verification
- Session management
- Google sign-in

Secrets must remain server-side.

Example environment variables:

```text
BETTER_AUTH_SECRET
BETTER_AUTH_URL
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
```

Never commit credentials.

---

## 12. API Standards

Use Hono.

All routes must:

- Validate input
- Authenticate when required
- Authorize clinic access
- Return predictable JSON
- Use consistent error formats
- Avoid leaking database internals

Recommended prefix:

```text
/api/v1
```

Examples:

```text
/api/v1/clinics
/api/v1/appointments
/api/v1/patients
/api/v1/services
```

Preferred success response:

```json
{
  "data": {}
}
```

Preferred list response:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 100
  }
}
```

Preferred error response:

```json
{
  "error": {
    "code": "APPOINTMENT_NOT_FOUND",
    "message": "Appointment not found."
  }
}
```

Do not expose stack traces in production.

---

## 13. Validation

Use Zod for all untrusted input.

Validate:

- Request bodies
- Route params
- Query params
- Form submissions
- Webhook payloads
- Environment variables

Frontend TypeScript types are not runtime validation.

---

## 14. Scheduling

Do not permanently generate all possible appointment slots.

Compute availability from:

```text
Dentist schedule
  ↓
Location assignment
  ↓
Schedule exceptions
  ↓
Time off
  ↓
Existing appointments
  ↓
Service duration
  ↓
Clinic rules
  ↓
Available slots
```

Relevant tables:

```text
dentist_schedules
dentist_schedule_exceptions
dentist_time_off
services
dentist_services
appointments
```

---

## 15. Double-Booking Protection

Frontend checks are not sufficient.

Required booking flow:

```text
Check availability
  ↓
Validate again during booking
  ↓
Execute transaction
  ↓
Reject conflicting booking
```

Use database-level safeguards where appropriate:

- Transactions
- Locks
- Range checks
- Unique constraints
- Exclusion constraints

When two users try to reserve the same slot, only one booking may succeed.

---

## 16. Appointment States

Recommended states:

```text
PENDING
CONFIRMED
CHECKED_IN
IN_PROGRESS
COMPLETED
CANCELLED
NO_SHOW
RESCHEDULED
```

Changes should be recorded in:

```text
appointment_status_history
```

---

## 17. Email

Use Resend.

Use the free tier for MVP development.

Email use cases:

- Verification
- Password reset
- Clinic invitations
- Appointment confirmations
- Appointment reminders
- Cancellations
- Reschedules
- Billing notices

Keep Resend behind an internal email service abstraction.

Do not scatter direct provider calls across route handlers.

---

## 18. File Storage

Use Cloudflare R2.

Use cases:

- Clinic logos
- Staff avatars
- Patient attachments
- Consent documents
- X-rays
- Invoice files

Do not store raw files in PostgreSQL.

Store file metadata in PostgreSQL and objects in R2.

Recommended object key:

```text
clinics/{clinicId}/patients/{patientId}/documents/{fileId}
```

Sensitive patient files must not be public by default.

Recommended metadata table:

```text
file_objects

id
clinic_id
owner_type
owner_id
storage_provider
bucket
object_key
mime_type
size_bytes
created_by
created_at
```

---

## 19. Cloudflare Deployment

Primary MVP infrastructure for DentivoHQ:

```text
landing   → Cloudflare Pages
dashboard → Cloudflare Pages
console   → Cloudflare Pages
api       → Cloudflare Workers
files     → Cloudflare R2
dns       → Cloudflare
```

Do not introduce Railway unless a concrete runtime requirement justifies it.

During development, free Cloudflare subdomains may be used:

```text
*.pages.dev
*.workers.dev
```

The intended brand is **DentivoHQ**, but no production `.com` domain should be assumed until it is actually registered.

Future preferred domain layout, if `dentivohq.com` is acquired:

```text
dentivohq.com          → marketing site
app.dentivohq.com      → clinic dashboard
api.dentivohq.com      → API
console.dentivohq.com  → internal platform console
```

These are planning examples only. All application URLs must remain configurable through environment variables.

Custom production domains are expected to be a paid annual cost.

---

## 20. Cloudflare Workers Constraints

Workers are stateless request runtimes.

Avoid:

- Filesystem assumptions
- Background loops
- Long-lived process assumptions
- Persistent in-memory business state
- Node native modules without Workers compatibility

Prefer:

- Stateless request handlers
- PostgreSQL for durable data
- R2 for files
- Scheduled/background Cloudflare features where suitable
- Explicit caching

---

## 21. Docker

Use Docker for:

- Local development
- Reproducible supporting services
- Local PostgreSQL when useful
- CI workflows when justified

Do not require Docker for tasks that work well with a simple local command.

---

## 22. CSS and UI

Use Tailwind CSS and shadcn/ui.

Rules:

- Prefer utility classes
- Keep design tokens consistent
- Avoid large custom CSS files
- Prefer shared components
- Extend existing components rather than duplicating them
- Avoid adding another large UI framework without approval

Do not introduce Material UI, Ant Design, or similar frameworks by default.

---

## 23. React Standards

Use functional components.

Prefer:

- Hooks
- Composition
- Small focused components
- Explicit props
- Controlled side effects

Avoid:

- Class components
- Huge page components
- Business logic buried in JSX
- Unnecessary global state

Use local state when local state is sufficient.

---

## 24. State Management

Do not add a global state library by default.

Prefer:

- React local state
- URL state
- Server state
- Query caching

A new global state dependency requires a real need.

---

## 25. Frontend Data Access

Frontend apps must never connect directly to PostgreSQL.

Required separation:

```text
React UI
  ↓
API client
  ↓
Hono API
  ↓
Domain logic
  ↓
Database
```

Database credentials must never reach browser applications.

---

## 26. Migrations

All database changes must use migrations.

Every schema change should include:

- Migration
- Updated types
- Updated validation
- Tests where relevant

Do not rewrite already-applied production migrations.

Create a new migration.

---

## 27. Audit Logging

Important actions must create audit records.

Examples:

```text
CLINIC_CREATED
CLINIC_SETTINGS_UPDATED

STAFF_INVITED
STAFF_REMOVED
ROLE_CHANGED

PATIENT_CREATED
PATIENT_UPDATED
PATIENT_RECORD_VIEWED

APPOINTMENT_CREATED
APPOINTMENT_RESCHEDULED
APPOINTMENT_CANCELLED

FILE_UPLOADED
FILE_DELETED
```

Audit records should be append-only wherever practical.

Application logs and audit logs are separate systems.

---

## 28. Security Rules

Agents must not introduce code that:

- Trusts client-provided clinic IDs without validation
- Exposes secrets
- Stores plain-text passwords
- Makes patient files public by default
- Logs sensitive medical data
- Returns stack traces to users
- Bypasses server authorization
- Uses weak security tokens
- Removes tenant filtering

Potentially sensitive data includes:

- Patient identity
- Contact information
- Appointment history
- Medical history
- Clinical notes
- X-rays
- Consent forms
- Payment records

Do not place sensitive patient data in:

- Analytics events
- URLs
- Browser logs
- Public caches
- Error messages
- Public object names

---

## 29. Environment Variables

Server secrets belong in environment variables.

Examples:

```text
DATABASE_URL

BETTER_AUTH_SECRET
BETTER_AUTH_URL

GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET

RESEND_API_KEY

R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
```

Never expose server secrets with Vite public environment prefixes.

---

## 30. Brand Naming Conventions

Canonical product name:

```text
DentivoHQ
```

Use this exact capitalization in:

- User-facing UI
- Marketing copy
- Documentation
- Page titles
- Email templates
- Product metadata
- Release notes

Recommended technical variants:

```text
dentivohq      → package scopes, slugs, machine identifiers when needed
DentivoHQ      → product/UI name
DENTIVOHQ      → only where an all-caps identifier is technically required
```

Do not rename the product casually or introduce alternate public-facing names without explicit project-owner approval.

Do not hardcode `dentivohq.com` yet. Domain ownership will be addressed closer to production deployment.

---

## 31. Naming Conventions

Use `camelCase` for:

- Variables
- Functions
- Object properties

Use `PascalCase` for:

- React components
- Types
- Classes

Use `snake_case` for:

- PostgreSQL tables
- PostgreSQL columns

Use `kebab-case` for:

- URLs
- File names where appropriate

---

## 32. TypeScript

Use strict TypeScript.

Avoid `any`.

Prefer `unknown` for untrusted values.

Infer types from:

- Zod
- Database schema
- Shared contracts

Avoid manually duplicating the same type across layers.

---

## 33. Error Handling

Use intentional error categories.

Examples:

```text
ValidationError
AuthenticationError
AuthorizationError
NotFoundError
ConflictError
RateLimitError
InternalError
```

Appointment conflicts should return a conflict-style error, not a generic 500.

Never expose internal SQL or infrastructure details to users.

---

## 34. Testing

Use:

- Vitest
- Playwright

Priority order:

1. Tenant isolation
2. Authentication
3. Authorization
4. Appointment conflicts
5. Scheduling
6. Clinic membership
7. Staff invitations
8. Email flows
9. File authorization
10. Subscription logic

Use unit tests for:

- Scheduling calculations
- Permission checks
- Validation
- Entitlements
- Date/time helpers

Use integration tests for:

- Database queries
- Tenant filtering
- Transactions
- Booking conflicts
- Sessions
- Webhooks

Use Playwright for:

- Clinic signup
- Clinic creation
- Staff invitation
- Dentist creation
- Service creation
- Schedule setup
- Patient booking
- Rescheduling
- Cancellation

---

## 35. Date and Time

Scheduling is timezone-sensitive.

Every clinic location must have a timezone.

Preferred rule:

```text
Store timestamps in UTC.
Display them in the clinic/location timezone.
```

Do not depend on server-local timezone.

---

## 36. IDs and Pagination

Prefer UUIDs or similarly strong globally unique identifiers.

Potentially large collections must use pagination.

Examples:

- Patients
- Appointments
- Clinics
- Audit logs
- Notifications

Avoid unbounded list endpoints.

---

## 37. Search

Start with PostgreSQL search capabilities.

Do not introduce Elasticsearch, Algolia, Meilisearch, or another search platform until real requirements justify it.

---

## 38. Background Work

Do not perform slow external operations inline when they can be handled asynchronously.

Examples:

- Send email
- Generate reports
- Process files
- Retry webhooks
- Schedule reminders

For MVP, prefer Cloudflare-compatible scheduled/background mechanisms.

Do not introduce Kafka or complex queue infrastructure prematurely.

---

## 39. SaaS Billing

Future SaaS billing should use Stripe Billing unless the project owner changes this decision.

Keep billing logic behind internal abstractions.

Application code should reason about:

```text
plan
subscription status
entitlements
```

rather than scattering Stripe object checks throughout the codebase.

Potential entitlements:

```text
max_locations
max_dentists
max_staff
sms_enabled
patient_payments_enabled
advanced_reports_enabled
custom_domain_enabled
sso_enabled
api_access_enabled
```

---

## 40. Free-Tier First Policy

During MVP development, prefer:

```text
Frontend hosting  → Cloudflare Pages
API hosting       → Cloudflare Workers
Database          → Neon PostgreSQL Free Tier
Authentication    → Better Auth
Social Login      → Google OAuth
Email             → Resend Free Tier
File Storage      → Cloudflare R2 Free Tier
DNS               → Cloudflare
Local Dev         → Docker
CSS               → Tailwind CSS
UI                → shadcn/ui
```

Do not add paid infrastructure by default.

Before adding a managed service, first check whether the requirement can be satisfied by:

1. Existing stack
2. An open-source library
3. An existing free tier
4. Cloudflare
5. PostgreSQL
6. Self-hosted local tooling

Do not casually introduce:

- Auth0
- Clerk
- Firebase
- AWS S3
- SendGrid
- Redis Cloud
- Elasticsearch
- Datadog
- Algolia
- Railway
- Render
- Paid Vercel features

These can be valid later, but require explicit justification.

---

## 41. Dependency Policy

Before adding a dependency:

- Check if the platform already provides the feature
- Check if an existing dependency solves it
- Prefer small focused libraries
- Verify active maintenance
- Verify Workers compatibility for API packages
- Avoid redundant libraries

Do not add multiple libraries for the same job.

---

## 42. Package Manager

Use pnpm.

Commit:

```text
pnpm-lock.yaml
```

Do not introduce npm, Yarn, or Bun lockfiles unless the repository explicitly migrates.

Prefer root-level scripts such as:

```json
{
  "scripts": {
    "dev": "pnpm -r --parallel dev",
    "build": "pnpm -r build",
    "lint": "pnpm -r lint",
    "typecheck": "pnpm -r typecheck",
    "test": "pnpm -r test"
  }
}
```

---

## 43. CI/CD

Use GitHub Actions.

Recommended pipeline:

```text
Install
  ↓
Lint
  ↓
Typecheck
  ↓
Unit tests
  ↓
Integration tests
  ↓
Build
```

Critical checks must pass before merge.

---

## 44. Commit Practices

Keep changes focused.

Preferred commit examples:

```text
feat: add clinic invitation flow
fix: prevent overlapping dentist appointments
refactor: extract appointment validation service
test: add tenant isolation coverage
```

Avoid unrelated changes in the same commit.

---

## 45. Documentation

Update documentation when changing:

- Environment variables
- Database schema
- Authentication
- Deployment
- API contracts
- App structure
- Local setup
- Architecture

---

## 46. Agent Behavior

When working in this repository, an AI coding agent should:

1. Inspect existing patterns before changing code.
2. Reuse current abstractions.
3. Avoid unnecessary rewrites.
4. Keep changes scoped.
5. Preserve tenant isolation.
6. Preserve server-side authorization.
7. Add tests for security-critical logic.
8. Avoid new paid infrastructure by default.
9. Prefer PostgreSQL and Cloudflare capabilities before new services.
10. Keep Hono API code compatible with Cloudflare Workers.
11. Keep browser apps independent from direct database access.
12. Explain major architecture changes in code review notes or documentation.

---

## 47. Agent Must Not

Do not:

- Replace the approved stack without instruction
- Introduce microservices prematurely
- Add Kubernetes
- Add Kafka
- Add a second primary database
- Add another auth framework
- Add another large UI framework
- Add paid infrastructure without justification
- Store sensitive files publicly
- Trust client-side authorization
- Remove clinic filtering
- Hardcode credentials
- Commit secrets
- Bypass validation
- Disable security checks to make tests pass
- Change production schema without migrations

---

## 48. MVP Priority Order

```text
1. Monorepo foundation
2. Database foundation
3. Better Auth
4. Clinic creation
5. Clinic membership
6. Roles and permissions
7. Clinic locations
8. Staff invitations
9. Dentist profiles
10. Services
11. Dentist schedules
12. Patient profiles
13. Appointment engine
14. Public booking
15. Clinic appointment dashboard
16. Email notifications
17. File storage
18. Audit logs
19. SaaS subscriptions
20. Reports
```

Do not prioritize AI before the core appointment platform is reliable.

---

## 49. Phase 1 — SaaS Appointment MVP

Goal: build the first production-usable version of **DentivoHQ** as a multi-tenant SaaS.

Includes:

- Monorepo setup
- Authentication
- Google login
- Clinic registration
- Tenant model
- Staff membership
- Roles and permissions
- Locations
- Dentists
- Services
- Dentist schedules
- Patients
- Appointment booking
- Appointment management
- Rescheduling
- Cancellation
- Email reminders
- Basic R2 file storage
- Audit logs
- Initial SaaS subscription support

Phase 1 should stay within free tiers wherever practical.

Expected clinic journey:

```text
Register
  ↓
Create clinic
  ↓
Add location
  ↓
Add services
  ↓
Add dentists
  ↓
Configure schedules
  ↓
Invite staff
  ↓
Publish booking page
  ↓
Receive bookings
  ↓
Manage appointments
  ↓
Send reminders
```

---

## 50. Phase 2 — Operations and Patient Experience

Goal: expand **DentivoHQ** from appointment SaaS into stronger dental operations software.

Includes:

- Patient portal
- Patient payments
- Invoices
- Clinical documents
- Consent forms
- Medical history
- Treatment records
- Waiting list
- Recurring appointments
- Advanced reminders
- Reporting
- Custom booking pages

Potential future payment provider:

- Stripe Connect

Keep payment provider code abstract enough to support regional alternatives later.

---

## 51. Phase 3 — Enterprise and Intelligence

Goal: evolve **DentivoHQ** to support larger dental groups and enterprise customers.

Includes:

- Enterprise organizations
- Advanced multi-location reporting
- SSO
- Custom domains
- Public API
- External integrations
- Insurance workflows
- Dental charting
- AI assistance
- No-show prediction
- Intelligent scheduling
- Advanced analytics

Do not implement these before Phase 1 is stable.

---

## 52. Core Architecture Principle

Every sensitive request should follow:

```text
Request
   ↓
Authentication
   ↓
Clinic context
   ↓
Membership check
   ↓
Permission check
   ↓
Input validation
   ↓
Business validation
   ↓
Database transaction
   ↓
Audit log
   ↓
Background work if required
   ↓
Response
```

This principle should remain true through all phases.

---

## 53. Decision Priority

When several technical solutions are valid, choose based on:

```text
1. Security
2. Tenant isolation
3. Correctness
4. Simplicity
5. Maintainability
6. Portability
7. Free-tier compatibility
8. Performance
9. Developer convenience
```

Do not optimize prematurely at the cost of security or maintainability.

---

## 54. Final Instruction

Treat this file as the default architecture contract for the **DentivoHQ** repository.

When implementing features:

- Use **DentivoHQ** as the canonical product name.
- Respect the approved stack.
- Keep the system multi-tenant by default.
- Keep protected operations server-authorized.
- Use PostgreSQL as the source of truth.
- Use Better Auth for authentication.
- Use Hono for backend routes.
- Keep frontend apps independent from direct database access.
- Prefer free-tier infrastructure during MVP development.
- Keep code portable and modular.
- Add infrastructure only when a real requirement exists.
- Treat patient and clinic data as sensitive.
- Preserve a clear path from MVP to production-scale SaaS.

### Security and dependencies

- Never commit secrets, provider tokens, OAuth credentials, database URLs, or private receipt URLs.
- Keep uploads private, validated by type and size, and authorized before access.
- Review dependency diffs and the lockfile whenever dependencies change.

### Validation and handoff

Run the smallest relevant checks, then broader workspace checks when shared contracts, database schemas, routing, auth, or deployment wiring change. Report pre-existing warnings separately from regressions. Do not claim a deployment, live endpoint, or Backlog.md update without verifying it.

Use Conventional Commits when committing. Do not commit unless requested or required by the requested workflow.

### Release promotion workflow

Use `.agents/skills/release-promotion/SKILL.md` whenever the user asks to assess, create, merge, or follow through on a `staging` to `main` promotion, or asks to publish a GitHub release.

For every `staging` to `main` promotion PR, assess the commits since the latest release tag and include a release recommendation in the handoff:

- state `release required` or `release not required`;
- explain which included changes drive that result;
- recommend `patch`, `minor`, or `major` when a release is required;
- after merge, remind the user that production deployment is automatic but GitHub release publication is a separate guarded action.

Do not silently choose a version bump. If the user has not specified or confirmed `patch`, `minor`, or `major`, recommend one and request confirmation. When the user explicitly asks to publish a named bump or confirms the recommendation, use the repository Release workflow and verify the resulting tag, release, production SHA, and health evidence before reporting success.

If an implementation choice conflicts with this file, follow this file unless the project owner explicitly approves the change.
