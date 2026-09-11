# FamilyLedger — Three-Day Development and Deployment Plan

Schedule: Friday 11 September through Sunday 13 September 2026  
Timezone: Asia/Kolkata (IST)  
Coding days: Friday and Saturday  
Deployment day: Sunday  
Delivery target: signed iOS/Android pilot release with a production-ready backend, distributed through TestFlight and Google Play internal testing

## 1. Outcome and scope rule

The full FamilyLedger specification is a multi-sprint product. It cannot be responsibly completed—with all reports, import/export, receipts, reconciliation, audit tooling, accessibility, store review, and security hardening—in two coding days.

The three-day objective is therefore a complete, secure vertical-slice MVP that proves the central product loop:

1. A user authenticates.
2. The user creates a family.
3. The Owner creates and shares an invitation link.
4. A second user opens the link, authenticates, and requests access.
5. The Owner approves the request.
6. Approved members see the shared family ledger.
7. Owner and Member can add income or expenses under the agreed permissions.
8. Home and Monthly Report show authoritative shared totals.
9. The app is built and delivered as native Android and iOS pilot binaries.

This is not a disposable prototype. The repository, database tenancy, RLS, money representation, route structure, contracts, migrations, and release profiles will follow the completed specification so later features can be added without rebuilding the foundation.

## 2. Sunday release definition

### 2.1 Included in the pilot build

- Expo/React Native application for iOS and Android.
- Expo Router native navigation.
- Email OTP/magic-link authentication.
- Profile bootstrap with display name, locale, and timezone.
- Create family with INR/Asia-Kolkata defaults.
- One active family at a time; family switching if the user belongs to multiple families.
- Owner, Member, and pending membership states.
- Create, share, inspect, revoke, request, approve, and reject invitation flow.
- Default income and expense categories.
- Create at least one account with beginning balance.
- Shared income and expense creation.
- Transaction list with date/type/account/category filters.
- Member edits/deletes own transaction; Owner edits/deletes all.
- Recoverable transaction deletion in the database.
- Home summary: income, expense, net, savings rate, account total, recent activity.
- Monthly report: totals, zero-income handling, category breakdown, and top categories.
- RLS tests for anonymous, pending, wrong-family, Member, and Owner access.
- Loading, empty, validation, connectivity, unauthorized, and session-expired states for pilot screens.
- EAS development/preview/production profiles.
- TestFlight internal build and Google Play internal-testing build, subject to accounts and credentials being available.

### 2.2 Explicitly deferred after Sunday

- Annual and custom-range reports and the remainder of all 15 chart presentations.
- CSV/XLSX import and rollback.
- Export generation.
- Receipt capture and storage.
- Admin and Viewer UI, although the database enum may already support them.
- Reconciliation workflow and signed balance adjustments.
- Native push notifications.
- Complete audit-history UI.
- Offline writes; only local form drafts may be retained.
- Category merge/reorder/archive management UI.
- Family ownership transfer and scheduled family deletion UI.
- Public App Store/Play production release.

The database may include forward-compatible columns/tables for these features, but unfinished functionality will not be exposed in the Sunday UI.

## 3. Deployment expectation

“Deployed on Sunday” means:

- production Supabase migrations are applied and verified;
- production environment variables and deep-link allowlists are configured;
- signed Android `.aab` and iOS `.ipa` builds are produced;
- Android is uploaded to Play internal testing;
- iOS is uploaded to TestFlight internal testing;
- pilot users receive installation instructions;
- a release record, smoke-test report, and rollback instructions exist.

Apple and Google control public review timelines. Public store availability cannot be guaranteed on Sunday. Internal testing is the deterministic Sunday target; production submission can be initiated Sunday after the pilot gate passes.

## 4. Required inputs before coding begins

The following should be ready by Friday morning. Missing store credentials do not block coding, but they do block part of Sunday deployment.

### Product and identity

- Confirm working app name `FamilyLedger`.
- Confirm iOS bundle ID, recommended placeholder: `com.<owner>.familyledger`.
- Confirm Android package ID using the same reverse-domain form.
- App ownership/legal entity name for store listings.
- Support email and privacy-policy URL or an approved temporary hosted policy.

### Accounts and credentials

- GitHub repository access or approved local repository location.
- Supabase organization/project access.
- Expo organization/account access.
- Apple Developer and App Store Connect access for iOS distribution.
- Google Play Console access for Android distribution.
- Google OAuth credentials if Google sign-in is included in the three-day build.
- Apple Sign in credentials if third-party login is enabled on iOS.

### Devices and testers

- At least one Android phone or emulator.
- At least one iPhone/iOS simulator path; physical iPhone is preferred for deep links.
- Two different test identities to exercise approval boundaries.
- One Owner pilot user and one invited Member pilot user.

If social-login credentials are unavailable by Friday noon, Sunday scope uses email OTP only. Google and Apple buttons remain hidden behind a feature flag rather than shipping broken providers.

## 5. Build strategy

Development follows thin vertical slices. Each slice includes database migration, RLS policy, typed contract, mobile repository function, screen behavior, tests, and a small commit. We do not build all database code first and postpone integration until Saturday night.

Implementation order:

```text
repository/build
  → authentication/deep links
  → family creation
  → invitation/request/approval
  → account/category setup
  → transaction creation/list
  → shared totals/monthly report
  → release hardening
```

The central family approval flow is completed before financial screens. This ensures the product’s differentiator and security boundary are proven first.

## 6. Day 1 — Friday: foundation, authentication, and family collaboration

Target duration: approximately 10–12 focused hours.  
Day-one exit: two test identities can complete create family → share invitation → request access → Owner approval, and the pending user cannot read family data before approval.

### 08:30–09:00 — Kickoff and release lock

Actions:

1. Confirm repository location, application identifiers, environment names, and available store credentials.
2. Record the Sunday release scope and deferred list in the repository README.
3. Choose the production bundle/package identifiers once; changing them after store setup is expensive.
4. Create a release checklist with named gates: Android, iOS, database, security, pilot.
5. Create Git branch `codex/three-day-mobile-mvp` unless the user specifies another branch.

Output:

- Locked release scope.
- Environment/account checklist.
- Initial branch and first planning commit.

### 09:00–10:15 — Repository bootstrap

Agent actions:

1. Initialize pnpm workspace according to `MOBILE_IMPLEMENTATION_BLUEPRINT.md`.
2. Create `apps/mobile` with the current stable Expo template and TypeScript.
3. Add Expo Router and development-client configuration.
4. Create `packages/contracts`, `packages/domain`, and `packages/ui`.
5. Add root commands: `lint`, `typecheck`, `test`, `db:reset`, `db:test`, `generate:types`, and `check`.
6. Add `.env.example`; ensure actual secrets remain ignored.
7. Configure app schemes for development, preview, and production.
8. Add EAS profiles for development, preview, and production.

Verification:

- Clean dependency installation with a frozen lockfile.
- Expo config resolves without warnings.
- App launches on Android emulator/device.
- iOS configuration passes EAS configuration checks even if no local simulator is available.
- No secrets appear in Git status or bundle-visible config except Supabase URL/publishable key.

Commit: `chore: bootstrap FamilyLedger mobile workspace`

### 10:15–11:15 — Design system and application shell

Actions:

1. Implement workbook-derived warm canvas, blue income, and coral expense tokens.
2. Add native primitives: screen, text, button, input, list row, amount, empty state, error state, and loading skeleton.
3. Create root providers for theme, safe areas, query client, auth session, and active family.
4. Create route groups `(auth)`, `(onboarding)`, and `(tabs)`.
5. Implement native bottom tabs: Home, Activity, Reports, More.
6. Add a prominent Add Transaction action on Home and Activity.
7. Add feature flags for social login, reports, and release-deferred routes.

Verification:

- UI renders at 320–430 logical-pixel widths.
- Android back behavior and iOS modal-dismiss behavior are defined.
- Touch targets and screen-reader labels exist on navigation and primary actions.

Commit: `feat: add native shell and design tokens`

### 11:15–13:00 — Supabase foundation and initial migrations

Actions:

1. Initialize Supabase local configuration.
2. Split the planning DDL into numbered migrations needed for the pilot:
   - extensions/enums;
   - profiles/families/memberships;
   - invitations/join requests;
   - categories/accounts;
   - transactions;
   - helper functions, grants, indexes, and RLS.
3. Remove or postpone unused tables only if doing so reduces risk without changing migration numbering.
4. Add tenant-safe composite foreign keys.
5. Implement `is_active_member` and role-check functions with fixed `search_path`.
6. Add database seed fixtures for Owner, Member, second family, categories, account, and transactions.
7. Generate TypeScript database types.

Required RLS tests:

- anonymous cannot read any family financial row;
- pending user cannot read family/category/account/transaction rows;
- active Member reads only their own families;
- Member cannot read a second family;
- Owner sees their family;
- client cannot write audit events or membership approval directly.

Commit: `feat(db): add tenancy schema and default-deny RLS`

### 13:00–13:45 — Break and automated full check

Run the complete check while reviewing failures. No new feature begins until migrations reset from an empty database and the RLS test seed is deterministic.

### 13:45–15:15 — Authentication and native deep links

Actions:

1. Configure the Supabase React Native client with persisted sessions and AppState token refresh.
2. Store session material through the approved secure adapter; financial data does not enter SecureStore.
3. Implement email OTP/magic-link request and callback routes.
4. Configure development and production URL schemes and redirect allowlists.
5. Preserve an opaque invitation token through authentication without logging it.
6. Implement signed-out, restoring-session, signed-in/no-family, pending, active, and removed route guards.
7. Add profile bootstrap after first authentication.
8. Add Google/Apple providers only when credentials are verified; otherwise hide them through release config.

Tests:

- cold launch with and without session;
- expired link;
- cancelled provider flow;
- invitation opened before authentication;
- sign-out clears family-specific query/SQLite cache;
- removed membership cannot remain visible from cached screens.

Commit: `feat(auth): add native passwordless authentication and route guards`

### 15:15–16:30 — Atomic family creation

Actions:

1. Implement `create_family` RPC.
2. In one transaction: create family, make caller active Owner, seed categories, optionally create first account, and add audit event.
3. Add onboarding form: family name, currency, timezone, reporting start month/year.
4. Use INR, Asia/Kolkata, and current-year defaults without hiding editability.
5. Add idempotency to prevent duplicate family creation on double tap/retry.
6. Implement family switcher backed by active memberships.

Tests:

- retry returns the same outcome;
- failed seed rolls back the entire family;
- creator is exactly one Owner;
- other users cannot see the new family;
- selecting a different family replaces all family-scoped query keys.

Commit: `feat(family): create and switch households atomically`

### 16:30–19:00 — Invitation, request, and approval vertical slice

Actions:

1. Implement `create_invitation`, `inspect_invitation`, `request_join`, `decide_join_request`, and `revoke_invitation` RPCs.
2. Generate cryptographically random invitation token; persist only SHA-256 hash.
3. Build invitation share sheet with canonical HTTPS URL and native fallback scheme.
4. Build invite landing states: valid, expired, revoked, exhausted, already member, pending, and rejected.
5. Build Owner approval inbox with approve/reject action and concurrent-decision state.
6. Ensure approval creates/activates membership atomically and logs the decision.
7. Invalidate family/member queries after approval; no financial details are included in Realtime payloads.

Security tests:

- pending requester cannot read family data;
- raw token is returned only on creation and is absent from logs;
- expired/revoked/exhausted token cannot create a request;
- duplicate tap creates one request;
- Member cannot approve;
- Owner/Admin cannot approve into another family;
- approval is idempotent;
- rejection does not disclose household data.

Commit: `feat(invites): implement approval-gated family joining`

### 19:00–20:00 — Day-one integrated test and checkpoint

Run on two sessions/devices:

1. Owner authenticates and creates family.
2. Owner shares invite.
3. Member opens link and authenticates.
4. Member sees Pending Approval only.
5. Direct API read as pending Member fails.
6. Owner approves.
7. Member enters the active-family shell.
8. Owner removes/rejects test membership and access disappears.

Day-one hard gate:

- Stop feature work if any cross-family or pending-user RLS test fails.
- Capture failing requests by request ID with sensitive fields redacted.
- Tag the passing checkpoint `mvp-day-1`.

## 7. Day 2 — Saturday: transactions, reports, integration, and release candidate

Target duration: approximately 10–12 focused hours.  
Day-two exit: approved family members can share a correct ledger and see authoritative monthly totals in signed preview builds.

### 08:30–09:15 — Day-one regression and triage

1. Pull/inspect the exact Day-one checkpoint.
2. Reset database from zero and regenerate types.
3. Run auth/family/RLS suites.
4. Test one Android cold launch and one iOS/EAS configuration build.
5. Fix only release-blocking Day-one failures before continuing.

### 09:15–10:45 — Categories and accounts

Actions:

1. Finish India-oriented default categories with stable seed identifiers/names.
2. Implement list and create account; default account types: Cash, Savings, Current, Credit Card, Wallet, and Other.
3. Store beginning balance in integer minor units and opening date as `date`.
4. Implement category/account repositories and active-only selection controls.
5. Build minimal More → Accounts and More → Family routes.

Tests:

- duplicate normalized names rejected;
- cross-family category/account reference rejected;
- archived rows cannot accept new transactions;
- integer minor-unit parsing covers rupees/paise and invalid precision.

Commit: `feat(setup): add categories and household accounts`

### 10:45–13:00 — Transaction creation and permissions

Actions:

1. Implement `create_transaction`, `update_transaction`, `soft_delete_transaction`, and `restore_transaction` RPCs.
2. Build full-screen Add Transaction route with Income and Expense segments.
3. Fields: date, amount, category, account, relevant member, description, remarks.
4. Keep expense/income amounts positive; type determines calculation direction.
5. Add expected-version concurrency checks for update/delete/restore.
6. Add idempotency key generated when the form opens and retained through a retry.
7. Add unsaved-change warning and local draft storage.

Tests:

- double tap creates one transaction;
- category type must match transaction type;
- account/category must be active and same-family;
- Member can modify own only;
- Owner can modify all;
- stale edit returns current record with conflict code;
- soft-deleted row disappears from normal totals/list and remains restorable.

Commit: `feat(transactions): add secure household transaction mutations`

### 13:00–13:45 — Break and control-total run

Seed known transactions and compare raw SQL controls to expected workbook-derived totals before building the dashboard UI.

### 13:45–15:15 — Shared activity list

Actions:

1. Implement family-scoped transaction query using keyset pagination.
2. Add date, type, account, category, and member filters.
3. Build virtualized native list with income/expense distinction that does not rely only on color.
4. Add detail/edit route and delete confirmation.
5. Implement authoritative refresh after mutation and scoped Realtime invalidation.
6. Add empty, filtered-empty, loading, offline-cache, access-revoked, and error states.

Performance check:

- seed at least 8,100 transactions;
- first page remains bounded;
- query uses the intended family/date indexes;
- no screen attempts to load the full ledger into memory.

Commit: `feat(activity): add filterable shared ledger`

### 15:15–17:15 — Home and Monthly Report

Actions:

1. Implement the canonical monthly report RPC with inclusive start/exclusive end boundaries.
2. Return total income, expense, net, expense-to-income, savings rate, category totals, percentages, and top categories.
3. Calculate from non-deleted server rows; never from client list pages.
4. Use `null` for zero-income ratios and display `—` plus explanation.
5. Build Home cards, account total, recent activity, and quick-add action.
6. Build Monthly Report period selector, summary cards, category breakdown, and accessible chart/data alternative.
7. Add member/account filters only if the canonical RPC and tests are complete; otherwise keep the controls hidden rather than nonfunctional.

Required fixtures:

- empty family;
- income without expense;
- expense with zero income;
- negative net;
- same-day boundaries;
- leap day;
- category ranking tie;
- transaction on first and last day of month;
- more than legacy workbook row limits.

Commit: `feat(reports): add authoritative home and monthly reporting`

### 17:15–18:30 — Accessibility, errors, and privacy pass

1. Test VoiceOver/TalkBack labels on auth, family, invitation, transaction, and report routes.
2. Verify dynamic text does not hide primary actions.
3. Verify color is paired with sign/label for income and expense.
4. Confirm all forms associate validation messages with fields.
5. Redact amount, description, remarks, token, OTP, and account name from logs/telemetry.
6. Verify sign-out and membership removal clear local family cache.
7. Verify no service-role key or private provider credential exists in the mobile bundle or EAS public environment.

Commit: `fix: harden accessibility privacy and failure states`

### 18:30–20:30 — Release-candidate builds and full regression

Actions:

1. Freeze new features.
2. Run lint, typecheck, unit, database reset, RLS, contract, and component tests.
3. Run the Maestro critical path on Android.
4. Create EAS preview builds for Android and iOS.
5. Install Android preview build and complete the end-to-end flow.
6. Install/TestFlight or simulator-test iOS preview and repeat the critical path.
7. Test invitation opening from a messaging app/browser on both platforms.
8. Record known non-blocking issues in release notes.
9. Tag the passing commit `v0.1.0-rc.1`.

Saturday release blockers:

- any wrong-family/pending-user access;
- duplicate financial mutation;
- incorrect monthly total;
- broken invite handoff;
- crash in auth, family creation, approval, transaction entry, or Home;
- migration that cannot reset from zero;
- secret in repository or mobile bundle;
- Android or iOS signed build failure.

If a blocker remains at 20:30, Sunday begins with repair and deployment is delayed rather than bypassing the gate.

## 8. Day 3 — Sunday: production deployment and pilot release

Target duration: approximately 6–9 hours plus asynchronous build/store processing.  
No feature development is scheduled. Only release-blocking corrections are allowed.

### 09:00–09:45 — Release readiness review

1. Confirm `v0.1.0-rc.1` commit and clean working tree.
2. Review open issues and verify none match the blocker policy.
3. Confirm production Supabase, EAS, Apple, and Google credentials.
4. Confirm privacy policy, support contact, screenshots, app name, icons, version `0.1.0`, iOS build number, and Android version code.
5. Confirm Owner/Member pilot identities and a separate store-review demo family.
6. Record go/no-go decision.

### 09:45–10:45 — Production backend

1. Verify a current production backup or empty-project recovery point.
2. Apply reviewed migrations in order with the deploy identity.
3. Regenerate/compare database types to ensure the app matches production.
4. Configure exact auth redirects, app scheme, universal link/App Link paths, email templates, and rate limits.
5. Create only required storage buckets; keep receipts disabled if deferred.
6. Seed reference categories through the family-creation RPC, not global production test data.
7. Run production-safe RLS smoke tests with dedicated test families.
8. Remove test data or retain only the clearly named reviewer demo family.

Gate: do not build production binaries until authentication and cross-family RLS smoke tests pass against production.

### 10:45–12:15 — Signed production builds

1. Set production EAS environment values: Supabase URL, publishable key, feature flags, environment name, and observability DSN if approved.
2. Confirm private keys remain EAS secrets/server-only.
3. Create Android and iOS production builds from the tagged commit.
4. Verify build fingerprints, runtime version, application identifiers, version/build numbers, permissions, and signing identities.
5. Retain build URLs/IDs in the release record.

If native configuration changed after Saturday’s preview build, rerun critical smoke tests on the production binaries before submission.

### 12:15–13:00 — Break/store processing buffer

Use this window to prepare tester instructions and release notes. Do not modify the release commit while builds process.

### 13:00–14:30 — Store uploads

Android:

1. Upload `.aab` to Google Play internal testing.
2. Verify app signing, Data Safety, privacy-policy URL, tester list, country availability, content rating, and release notes.
3. Publish to internal testers.
4. Install from the Play testing link on a clean device/account.

iOS:

1. Submit `.ipa` to App Store Connect/TestFlight.
2. Resolve export-compliance and privacy questions accurately.
3. Add internal testers and review metadata.
4. Install processed build through TestFlight.
5. Verify Sign in with Apple availability if Google login is enabled.

### 14:30–16:00 — Production smoke test

Run the exact production binary and backend:

1. Fresh install and launch.
2. Email OTP/deep-link authentication.
3. Owner family creation.
4. Invitation sharing.
5. Second identity request and pending access denial.
6. Owner approval.
7. Member adds expense; Owner adds income.
8. Both devices see the shared activity.
9. Home/Monthly totals equal manual control calculation.
10. Member cannot edit Owner transaction.
11. Owner can edit Member transaction.
12. Sign-out clears visible family data.
13. Reopen app and restore valid session.
14. Disable network and verify cached data is clearly marked stale and writes are blocked/drafted.

Record platform, app build, user IDs, request IDs, expected totals, actual totals, result, and tester. Do not record financial descriptions or raw invitation/auth tokens.

### 16:00–17:00 — Release and handoff

1. Mark pilot release `v0.1.0` if both platform gates pass.
2. Send tester installation instructions and known limitations.
3. Publish concise release notes.
4. Enable alerts for crash-free sessions, authentication failures, report RPC failures, and authorization errors.
5. Assign an incident contact for the first 24 hours.
6. Freeze schema changes until Monday review.
7. Create post-pilot backlog from deferred features and pilot feedback.

## 9. Agent execution model

This is how I will build the project once the user provides/approves the coding location and required accounts.

### 9.1 Before each implementation block

1. Read repository instructions (`AGENTS.md`, README, package scripts, existing architecture).
2. Inspect Git status and preserve unrelated user changes.
3. Restate the current slice’s acceptance criteria in a short task checklist.
4. Identify database, contract, mobile, and test files that must change together.
5. Confirm whether an action is local/reversible or an external deployment requiring existing authorization.

### 9.2 During implementation

1. Make small patches rather than replacing broad user-owned files.
2. Implement database constraint/RLS first for security-sensitive behavior.
3. Generate/update typed contracts before wiring the UI.
4. Build one functioning vertical slice at a time.
5. Run the narrowest relevant tests after each patch, then the full gate at checkpoints.
6. Report concise progress at meaningful boundaries or at least every 60 seconds during long operations.
7. Never put service-role, signing, SMTP, Apple, Google, or EAS secrets into source code or command output.
8. Stop and fix any tenant-boundary or financial-correctness failure immediately.

### 9.3 Commit/checkpoint discipline

Recommended commits:

1. `chore: bootstrap FamilyLedger mobile workspace`
2. `feat: add native shell and design tokens`
3. `feat(db): add tenancy schema and default-deny RLS`
4. `feat(auth): add native passwordless authentication and route guards`
5. `feat(family): create and switch households atomically`
6. `feat(invites): implement approval-gated family joining`
7. `feat(setup): add categories and household accounts`
8. `feat(transactions): add secure household transaction mutations`
9. `feat(activity): add filterable shared ledger`
10. `feat(reports): add authoritative home and monthly reporting`
11. `fix: harden accessibility privacy and failure states`
12. `chore: prepare v0.1.0 pilot release`

I will not push, create store submissions, or mutate production merely because local coding is complete. Those actions happen within the Sunday deployment scope using the accounts and destination the user supplies.

### 9.4 Agent verification evidence

At handoff I will provide:

- changed-file summary;
- exact test commands and results;
- migration list and production status;
- Android/iOS build identifiers;
- store/internal-testing status;
- known limitations;
- security and reporting control results;
- rollback steps;
- next recommended backlog item.

## 10. Test matrix for the three-day release

| Area | Minimum automated proof | Minimum device proof |
|---|---|---|
| Authentication | callback parsing, expired link, route guards, session clearing | email link opens installed app on Android and iOS |
| Family | atomic Owner creation, idempotency, family isolation | create/switch family |
| Invitation | hash/expiry/use count, pending denial, approval authorization | share link, request, approve/reject |
| Transactions | validation, cross-family FK, role matrix, idempotency, conflict | add/edit/delete from two users |
| Reports | independent control fixtures and boundary dates | Home/Monthly totals match manual calculation |
| Cache | namespace clear on sign-out/removal | offline stale banner and blocked/draft write |
| Accessibility | component labels and state text | VoiceOver/TalkBack critical path smoke |
| Release | config and secret scan | clean install from internal store track |

## 11. Contingency rules

### If iOS credentials are unavailable

Complete EAS iOS preview/config validation and Android internal deployment. Do not claim iOS deployment; schedule the credentialed TestFlight step when access is supplied.

### If public deep-link domain is unavailable

Use the native scheme for development/preview and generate invitations that can be copied manually into an Accept Invite screen. Do not pretend universal links are complete. Domain setup becomes the first deployment blocker.

### If email OTP delivery is unreliable

Verify custom SMTP/domain configuration. For internal testing only, use documented Supabase test identities or a controlled fallback; never disable authentication or approval.

### If a report differs from control totals

Block the release, preserve the failing seed, inspect date boundaries/deleted rows/category joins, and repair the canonical SQL RPC. Never patch display totals on the client.

### If RLS fails

Block all deployment. Remove overly broad grants/policies, add a negative regression test, and rerun the entire authorization matrix.

### If time runs short Saturday

Cut in this order:

1. social login, retaining email OTP;
2. Realtime auto-refresh, retaining manual pull-to-refresh;
3. optional filters;
4. chart graphics, retaining correct accessible category data;
5. multi-family switcher polish.

Never cut RLS, approval gating, idempotency, integer money, canonical totals, session/cache clearing, migration reproducibility, or signed-build smoke testing.

## 12. Sunday go/no-go checklist

Release is **GO** only when every item below is true:

- [ ] Tagged source commit is clean and reproducible.
- [ ] Database migrations apply from zero and to production without manual edits.
- [ ] RLS negative matrix passes.
- [ ] No secrets are committed or embedded in client-visible configuration.
- [ ] Pending and wrong-family users cannot access household data.
- [ ] Duplicate submit does not duplicate a family, request, or transaction.
- [ ] Home and Monthly totals match independent control values.
- [ ] Invitation/auth deep links work in signed Android and iOS builds.
- [ ] Critical route has no crash or blocked accessibility action.
- [ ] Android internal build installs from Play testing.
- [ ] iOS internal build installs from TestFlight.
- [ ] Privacy policy, support contact, and store disclosures are present.
- [ ] Rollback owner and first-24-hour incident contact are known.

If one platform is blocked only by missing external credentials, release the passing platform to its internal track and label the other accurately as “build-ready, not deployed.” Any security, data-integrity, or reporting failure makes the entire release **NO-GO**.

## 13. Monday continuation

On Monday, review pilot evidence and begin the original backlog rather than expanding the Sunday build ad hoc. Recommended order:

1. Fix pilot defects and complete social login/deep links if gated.
2. Annual and custom reports plus remaining workbook chart parity.
3. Account reconciliation and adjustments.
4. CSV import, duplicate preview, commit and rollback.
5. Export and privacy deletion flows.
6. Native push notifications.
7. Receipt attachments.
8. Full store-production readiness and phased public rollout.

The detailed long-term scope remains governed by `EXPENSE_TRACKER_PRODUCT_SYSTEM_SPEC.md`, `MOBILE_IMPLEMENTATION_BLUEPRINT.md`, `DATABASE_SCHEMA.sql`, `API_CONTRACTS.md`, and `SPRINT_BACKLOG.md`.
