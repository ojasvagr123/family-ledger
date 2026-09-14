# Day 1 Execution Record

Date: 11 September 2026  
Branch: `codex/three-day-mobile-mvp`

## Phase 1 — Mobile foundation

Status: complete.

- Created a pnpm monorepo and Expo SDK 57 React Native app for iOS and Android only.
- Added Expo Router route groups, shared UI primitives, workbook-derived design tokens, typed environment validation, React Query, SecureStore-backed Supabase auth, and SQLite capability.
- Added native identifiers, app scheme, EAS build profiles, splash configuration, and mobile-only platform configuration.
- Added shared contracts/domain packages and reproducible root scripts.

## Phase 2 — Secure backend foundation

Status: complete and verified against local Supabase.

- Added ordered PostgreSQL migrations for profiles, families, memberships, invitations, join requests, categories, accounts, transactions, audit events, and idempotency records.
- Added tenant-safe composite foreign keys, indexes, default-deny RLS, restricted grants, hashed invitation tokens, audit writes, and idempotent security-definer RPCs.
- Added authorization assertions for protected tables and direct-write denial.

## Phase 3 — Family vertical slice

Status: application implementation complete; automated two-identity database flow verified.

- Implemented passwordless email sign-in and callback handling.
- Implemented family creation with default Indian categories, currency/timezone defaults, and family switching.
- Implemented single-use invitation creation and native sharing.
- Preserved invitation tokens securely across sign-in and routed new users back to the join request.
- Implemented pending-access isolation plus Owner/Admin approval and rejection screens.
- Hid membership-management controls from Member/Viewer roles.

## Verification evidence

- TypeScript: pass (`pnpm --filter @family-ledger/mobile typecheck`).
- ESLint: pass (`pnpm --filter @family-ledger/mobile lint`).
- Expo public config: pass; SDK 57, Android/iOS only, identifiers and native plugins resolved.
- Android Metro production export: pass; 1,470 modules bundled to Hermes bytecode.
- Database reset/reproducibility: pass.
- Database authorization and two-identity family flow: pass, 29 tests.
- Local Auth health endpoint: pass (`HTTP 200`).

## User-provided prerequisites

Needed for physical-device validation:

1. Keep Docker Desktop running while using local Supabase.
2. Provide two test email addresses/accounts for the Owner/Member approval test. They can be entered directly on the devices and do not need to be committed.

Android emulator development uses `127.0.0.1` through `adb reverse` to reach Supabase on the Windows host. The ignored `apps/mobile/.env` is configured accordingly.

Needed before Sunday deployment:

1. Confirm the permanent iOS bundle identifier and Android package name (placeholder: `com.familyledger.app`).
2. Sign in to an Expo/EAS account.
3. Provide Apple Developer/App Store Connect and Google Play Console access for the platforms being deployed.
4. Provide the HTTPS invitation domain, privacy-policy URL, and support email.

No private secrets should be pasted into documentation or committed to Git.

## Follow-up audit, 13–14 September

Closed implementation gaps: invitation inspection, Owner member removal, protected financial routes, access rechecking, cached-data handling, retry keys for family/join forms, editable currency/timezone, code-based sign-in and callback error recovery.

The original 29 assertions still pass within the expanded 70-assertion suite. The actual Supabase Auth/PostgREST two-identity create/invite/request/approve/financial-access integration also passes. New email-code delivery and verification pass against the local inbox.

Day 1 core implementation and automated backend gates are covered. The complete two-session native UI test and signed-platform checks remain open; see DAY_2_EXECUTION.md. Do not infer signed-build readiness from the earlier Android launch or JavaScript export.

The local Android `.env` now uses `http://127.0.0.1:54321` with an ADB reverse bridge; `scripts/start-local-android.ps1` sets the bridge for each emulator session.
