# DentivoHQ Current Base TODO Checklist

This checklist tracks the repository-backed work required to complete the **Current Base: Secure Scheduling Foundation** milestone.

Repository assessment date: **September 2, 2026**

## Current assessment

The approved architecture and core backend primitives are present, but DentivoHQ is not yet operationally complete. The remaining work is concentrated in:

- Real clinic onboarding and management workflows
- Tenant-security verification
- Scheduling correctness and edge cases
- Public booking and notification resilience
- Private-file authorization
- CI, preview deployment, and recovery readiness

### Verification baseline

- Lint: passed
- Type checking: passed
- Unit tests: 5 passed
- Build: passed
- Playwright preview tests: 4 passed
- PostgreSQL integration tests: 3 skipped because a test database was unavailable locally
- Repository status: an initial baseline commit exists; generated review artifacts and ignore coverage are being corrected before BASE-001 is closed

## Priority definitions

- **P0 — Blocker:** Required before the Current Base can be called secure and clinic-operable.
- **P1 — Completion:** Required for a production-preview-quality foundation.
- **P2 — Hardening:** Required before broad clinic onboarding.

## 1. Repository and verification gate

- [x] **BASE-001 · P0 — Establish a reviewed Git baseline**
  - Review every untracked file, confirm `.gitignore` coverage, scan for secrets, and create the first focused baseline commit when authorized.
  - Acceptance: A clean checkout reproduces the workspace without local artifacts, build outputs, or credentials.
  - Status: Complete. The reviewed cleanup is recorded in a focused Git commit.
  - Evidence: Commit `c118ed3` tracks the initial project tree. The September 2 review found no real credentials, removed generated `.lavish` review files, expanded ignore coverage for environment variants and tool caches, and replaced the API's untracked generated `Env` type dependency with checked-in binding types.

- [x] **BASE-002 · P0 — Run migrations against real PostgreSQL**
  - Start the local PostgreSQL service, apply all migrations, run `pnpm db:check`, and execute the integration suite without skips.
  - Acceptance: All three existing database integration tests execute and pass rather than being skipped.
  - Status: Complete. The Docker Compose PostgreSQL 17 service is healthy and the repository migration/test path succeeds against it.
  - Evidence: `0001_foundation.sql` through `0004_appointment_workflow.sql` are recorded in `schema_migrations`; `pnpm db:check` passes; `packages/db/src/foundation.integration.test.ts` executes all three tests with 3 passed and 0 skipped.

- [x] **BASE-003 · P1 — Make skipped integration tests fail CI**
  - Require `TEST_DATABASE_URL` and prevent the integration job from reporting success when the database suite does not execute.
  - Acceptance: CI fails if every PostgreSQL integration test is skipped.
  - Status: Complete. The integration command requires a database URL, disallows an empty suite, and no longer conditionally skips the PostgreSQL tests.
  - Evidence: `tooling/vitest.integration.config.ts` fails configuration without `TEST_DATABASE_URL` and sets `passWithNoTests: false`; `test:integration` no longer uses `--passWithNoTests`; `packages/db/src/foundation.integration.test.ts` always defines and executes its three tests.

- [x] **BASE-004 · P1 — Add Playwright execution to CI**
  - Install Chromium in CI and run the existing E2E suite on pull requests and protected branches.
  - Acceptance: Landing and dashboard viewport tests are required CI checks.
  - Status: Complete. The required `validate` job installs Chromium and its Linux dependencies, then runs the repository Playwright suite on pushes to `main` and `staging` and on every pull request.
  - Evidence: `.github/workflows/ci.yml` runs `pnpm exec playwright install --with-deps chromium` followed by `pnpm test:e2e`; the suite covers the landing page and dashboard preview in desktop Chromium and Pixel 7 emulation.

## 2. Authentication and onboarding

- [ ] **AUTH-001 · P0 — Build the clinic creation wizard**
  - Connect the dashboard empty state to an operational clinic-creation and initial-setup flow.
  - Acceptance: A verified user can create a clinic and immediately proceed to location setup.
  - Evidence: The API supports clinic creation, but `apps/dashboard/src/components/dashboard-app.tsx` exposes only an empty state.

- [ ] **AUTH-002 · P0 — Complete the invitation acceptance UI**
  - Add the `/accept-invitation` dashboard route and connect it to the invitation acceptance API.
  - Acceptance: Invited staff can authenticate, accept a valid invitation once, and see only the invited clinic.
  - Evidence: Invitation emails generated in `apps/api/src/index.ts` point to a route that the dashboard does not implement.

- [ ] **AUTH-003 · P1 — Expose Google sign-in**
  - Add conditional Google OAuth controls to the dashboard authentication screen.
  - Acceptance: Google sign-in appears only when configured and returns to the correct environment-based URL.
  - Evidence: `packages/auth/src/server.ts` configures Google, while `apps/dashboard/src/components/auth-panel.tsx` offers only email/password.

- [ ] **AUTH-004 · P1 — Add password reset, verification, logout, and session UX**
  - Implement screens and recovery actions for password reset, email verification, expired links, sign-out, and expired sessions.
  - Acceptance: Every Better Auth lifecycle state has a deterministic user-facing result and recovery path.
  - Evidence: The Better Auth server behavior exists, but the dashboard has only sign-in and registration UI.

- [ ] **AUTH-005 · P1 — Test real authentication and membership boundaries**
  - Add API integration tests for unauthenticated, suspended, removed, wrong-clinic, and wrong-role requests.
  - Acceptance: Every protected route family proves both allowed and denied access cases.
  - Evidence: Current permission coverage consists of three role-mapping unit tests.

## 3. Clinic master-data operations

- [ ] **OPS-001 · P0 — Complete location management**
  - Add tenant-scoped list, update, archive, and reactivate endpoints and dashboard screens.
  - Acceptance: Clinic owners and administrators can safely manage multiple timezone-aware locations.
  - Evidence: A location creation endpoint exists, but there are no list or update routes.

- [ ] **OPS-002 · P0 — Complete dentist and assignment management**
  - Add dentist list, edit, and archive workflows plus location and service assignment management.
  - Acceptance: All provider inputs required by availability can be configured without SQL or direct API calls.
  - Evidence: Only dentist creation and assignment POST routes currently exist.

- [ ] **OPS-003 · P0 — Complete service management**
  - Add service list, edit, archive, and reactivate workflows with consistent price and currency handling.
  - Acceptance: Only active and correctly configured services can be offered for booking.
  - Evidence: A service creation endpoint exists, but no management screen or update route exists.

- [ ] **OPS-004 · P0 — Build schedule, exception, and time-off management**
  - Add list, create, update, and remove APIs and UI for recurring schedules, schedule exceptions, and time off.
  - Acceptance: Staff can manage and inspect every availability input through the dashboard.
  - Evidence: `dentist_schedule_exceptions` and `dentist_time_off` exist in the schema without operational endpoints.

- [ ] **OPS-005 · P0 — Complete patient management**
  - Add tenant-scoped patient list, search, details, update, archive, deduplication, and pagination.
  - Acceptance: Staff can reliably find or create a patient before booking.
  - Evidence: A patient creation endpoint exists, but there are no patient list or search routes.

## 4. Scheduling correctness and staff workflow

- [ ] **SCH-001 · P0 — Build the real appointment calendar and list**
  - Implement operational schedule views with filters for date, location, dentist, service, patient, and status.
  - Acceptance: Staff can inspect and navigate the clinic schedule using real API data.
  - Evidence: Dashboard navigation currently reports that operational screens are reserved for a future workflow.

- [ ] **SCH-002 · P0 — Build staff-side booking and appointment management**
  - Implement patient lookup or creation, valid slot selection, notes, confirmation, status changes, cancellation, and rescheduling.
  - Acceptance: The complete staff booking journey uses the existing protected scheduling APIs.
  - Evidence: Appointment APIs exist, but the staff-facing workflow is absent.

- [x] **SCH-003 · P0 — Enforce the appointment cancellation permission**
  - Separate cancellation from generic status updates or dynamically require `appointment.cancel` when the requested status is `CANCELLED`.
  - Acceptance: A role with `appointment.update` but without `appointment.cancel` cannot cancel an appointment.
  - Status: Complete. The status endpoint dynamically authorizes cancellation separately from other appointment updates.
  - Evidence: `permissionForAppointmentStatus()` maps `CANCELLED` to `appointment.cancel`, and its permission test proves a dentist can update an appointment but cannot cancel one.

- [x] **SCH-004 · P0 — Add booking idempotency**
  - Add clinic-scoped idempotency keys to staff booking, public booking, and rescheduling.
  - Acceptance: Retrying a completed request returns the original result without creating a duplicate or misleading conflict.
  - Status: Complete. Staff booking, public booking, and rescheduling require clinic-scoped idempotency keys and serialize matching requests in PostgreSQL.
  - Evidence: `0005_booking_idempotency.sql` stores request fingerprints and original appointment IDs; matching retries return the original result while mismatched reuse is rejected.

- [x] **SCH-005 · P0 — Fix cross-clinic patient identity mutation risk**
  - Define the intended cross-clinic patient identity model and prevent anonymous public booking from overwriting another clinic's shared patient identity data.
  - Acceptance: A public booking can never modify a patient profile owned or previously established through another clinic without explicit authorization.
  - Status: Complete. Patient profiles are tenant-owned and the database rejects cross-clinic profile links; anonymous booking never updates an existing profile.
  - Evidence: `0006_clinic_scoped_patient_profiles.sql` scopes email uniqueness to each clinic, adds a composite tenant foreign key, and isolates public-booking identity resolution by clinic.

- [ ] **SCH-006 · P1 — Expand scheduling edge-case tests**
  - Cover DST transitions, effective-date bounds, partial-day exceptions, time off, overlapping schedule rows, inactive resources, and service-duration boundaries.
  - Acceptance: Availability is proven in at least two IANA timezones and across DST boundary cases.
  - Evidence: No focused availability test cases currently exist.

- [ ] **SCH-007 · P1 — Test appointment lifecycle, history, and audit atomicity**
  - Test allowed and denied transitions, replacement appointment linking, rollback behavior, status history, audit entries, and notification side effects.
  - Acceptance: A failed operation leaves no partial appointment, history, audit, or notification state.
  - Evidence: The workflow is implemented in `packages/db/migrations/0004_appointment_workflow.sql` without matching integration coverage.

## 5. Public booking and notifications

- [ ] **BOOK-001 · P0 — Return only valid booking combinations**
  - Make public selections progressively filter locations, dentists, and services according to active assignments and scheduling eligibility.
  - Acceptance: Patients cannot select impossible dentist, service, and location combinations.
  - Evidence: `getPublicBookingConfig()` currently returns all three collections independently.

- [ ] **BOOK-002 · P1 — Align public-booking status and patient copy**
  - Decide whether public booking creates a request or a confirmed appointment, then align database state, API output, notifications, and UI copy.
  - Acceptance: The patient-facing message accurately reflects the persisted appointment state.
  - Evidence: Appointments default to `PENDING`, while `public-booking.tsx` says the appointment is confirmed.

- [ ] **BOOK-003 · P0 — Harden public-booking abuse controls**
  - Replace the clinic-only rate-limit key with privacy-safe source partitioning and add appropriate bot protection.
  - Acceptance: One abusive source cannot consume the entire clinic's booking allowance or create a denial of service.
  - Evidence: `enforcePublicRateLimit()` currently keys only on clinic slug.

- [ ] **BOOK-004 · P0 — Make notification claiming recoverable and idempotent**
  - Add job leases or processing timeouts, safe reclaiming, provider deduplication, timezone-aware content, and cancellation/reschedule cleanup.
  - Acceptance: A Worker interruption cannot permanently strand jobs or cause unsafe duplicate delivery.
  - Evidence: Claimed jobs can remain in `PROCESSING` indefinitely if execution stops before completion.

## 6. Files, audit, and tenant safety

- [x] **SEC-001 · P0 — Authorize file ownership before upload**
  - Replace arbitrary `ownerType` values with a validated enum and verify the owner belongs to the active clinic before writing to R2.
  - Acceptance: A file cannot reference a missing resource, another tenant's resource, or an unsupported owner type.
  - Status: Complete. Uploads accept only supported owner types and verify an active owner in the current clinic before R2 is called.
  - Evidence: `0007_file_ownership.sql` adds the `file_owner_type` enum and a tenant-enforcement trigger; the upload route calls `fileOwnerBelongsToClinic()` before object creation.

- [ ] **SEC-002 · P0 — Make R2 and metadata operations consistent**
  - Add compensating cleanup for failed uploads, retry-safe deletion, and orphan-object reconciliation.
  - Acceptance: Failures cannot leave untracked R2 objects or database rows pointing to missing objects.
  - Evidence: Upload writes to R2 before inserting metadata; deletion removes the object before deleting metadata.

- [ ] **SEC-003 · P1 — Prove private-file authorization**
  - Add tests for wrong clinic, wrong role, missing owner, deleted object, blocked MIME type, oversized upload, and private caching headers.
  - Acceptance: No test can retrieve or mutate another clinic's file metadata or R2 object.
  - Evidence: There are currently no file-route authorization tests.

- [ ] **SEC-004 · P1 — Complete and protect audit coverage**
  - Inventory all security-relevant actions, record safe metadata, and define append-only database permissions.
  - Acceptance: Clinic changes, membership events, sensitive patient access, appointments, and files create verified audit events without leaking patient data.
  - Evidence: `audit_logs` exists, but coverage and append-only enforcement are incomplete.

## 7. Platform and deployment readiness

- [ ] **PLAT-001 · P1 — Enforce plan entitlements server-side**
  - Apply plan limits transactionally when creating locations, dentists, and staff memberships.
  - Acceptance: Limit violations return explicit domain errors and cannot be bypassed through direct API calls.
  - Evidence: `planEntitlements` is declared in `packages/config/src/index.ts` but is not enforced.

- [ ] **PLAT-002 · P1 — Add dependency-aware readiness and safe observability**
  - Add database and binding readiness checks, request correlation, queue metrics, and structured logs that exclude patient information.
  - Acceptance: Operators can distinguish application, PostgreSQL, R2, email, and queue failures without exposing sensitive data.
  - Evidence: `/health` currently returns a static success response.

- [ ] **PLAT-003 · P2 — Create and verify a preview environment**
  - Configure Neon, Worker secrets, rate limiting, the R2 preview bucket, Cloudflare Pages URLs, CORS origins, and OAuth callbacks using environment-based domains.
  - Acceptance: A preview deployment completes the full clinic setup and public booking journey.
  - Evidence: The repository contains environment and Wrangler configuration, but no verified live preview evidence.

- [ ] **PLAT-004 · P2 — Exercise recovery and performance**
  - Run booking concurrency and load tests, notification retry drills, PostgreSQL backup/restore verification, and R2 orphan reconciliation.
  - Acceptance: Documented operating thresholds and recovery evidence exist before broad clinic onboarding.
  - Evidence: Existing concurrency coverage tests only two simultaneous conflicting appointment inserts.

## Recommended delivery gates

### Gate 1 — Prove the substrate

- `BASE-001` through `BASE-003`
- `SCH-003` through `SCH-005`
- `SEC-001` and `SEC-002`

### Gate 2 — Make clinic setup operable

- `AUTH-001` through `AUTH-005`
- `OPS-001` through `OPS-005`
- `PLAT-001`

### Gate 3 — Complete scheduling

- `SCH-001`, `SCH-002`, `SCH-006`, and `SCH-007`
- `BOOK-001` through `BOOK-004`
- `SEC-003` and `SEC-004`

### Gate 4 — Prove preview readiness

- `BASE-004`
- `PLAT-002` through `PLAT-004`
- Real API-backed end-to-end tests

## Definition of Current Base complete

The milestone is complete when the following journey works against real infrastructure and is protected by repeatable tests:

- [ ] A user can register or use Google, verify their email, and create a clinic.
- [ ] A clinic owner can add a location, service, dentist, assignments, schedules, exceptions, and time off.
- [ ] A clinic owner can invite staff, and role-specific access is enforced.
- [ ] Staff can create or find a patient and book from the operational calendar.
- [ ] A patient can book through the public page without seeing invalid combinations.
- [ ] Authorized staff can update status, reschedule, and cancel with the correct permissions.
- [ ] Appointment confirmation and reminder jobs are delivered or safely retried.
- [ ] Authorized staff can upload and retrieve a private patient file only from the owning clinic.
- [ ] Appointment history, audit events, notifications, and tenant isolation are verified.
- [ ] CI runs lint, type checks, unit tests, non-skipped PostgreSQL integration tests, builds, and Playwright tests.
- [ ] A Cloudflare and Neon preview deployment passes the complete clinic and patient journey.

## Explicitly out of scope

The following belong to later roadmap phases and should not delay completion of the Current Base:

- Waitlist and ASAP automation
- Two-way SMS inbox
- Digital intake forms
- Recall and recare automation
- Deposits and payments
- Patient portal
- Insurance eligibility verification
- AI receptionist
