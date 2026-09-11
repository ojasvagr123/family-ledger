# FamilyLedger Mobile — Sprint Backlog

Cadence: six two-week sprints plus release hardening. Estimates are Fibonacci story points for one focused full-time engineer; they are planning aids, not time commitments. P0 is required for store launch. P1 may ship immediately after launch only when marked.

## Delivery principles

- A story is done only with tests, telemetry redaction, loading/empty/error/offline states, Android+iOS review and accessibility labels.
- Authorization and reporting fixtures are built before UI relying on them.
- Every migration is reproducible from an empty database and from the previous release.
- No story can bypass RLS with a service key from the mobile app.
- Native-device proof is required for deep links, auth providers, notifications, camera/file access and store builds.

## Sprint 0 — Foundation and parity fixtures (target 34 points)

| ID | Pri. | Story | Pts | Acceptance criteria | Depends on |
|---|---:|---|---:|---|---|
| FND-01 | P0 | Bootstrap pnpm workspace and Expo development app | 5 | Android and iOS development builds start; strict TS, lint and test commands run from root | Bundle/package IDs |
| FND-02 | P0 | Configure local/staging Supabase | 3 | Local reset runs all migrations; staging has separate secrets and no production access | — |
| FND-03 | P0 | Establish CI and EAS profiles | 5 | PR runs lint/type/unit/database tests; development, preview, production build profiles validate | Expo account |
| FND-04 | P0 | Implement design tokens and native primitives | 5 | Light/dark themes; 44pt targets; typography, input, button, card, list row and chart colors match approved direction | Decision 1 |
| FND-05 | P0 | Encode workbook calculation fixtures | 8 | Independent fixtures cover income, expense, net, rates, category share, top 20, account balance and 12-month average | Workbook audit |
| FND-06 | P0 | Create schema migrations 0001–0005 | 5 | Identity through transactions reset cleanly; tenant FKs and constraints fail invalid rows | Schema review |
| FND-07 | P0 | Threat model and telemetry policy | 3 | Cross-family, token, device loss, export, import and notification threats have mitigations; financial fields excluded from telemetry | — |

Sprint exit: signed development builds run on one Android and one iOS device/simulator; database fixtures prove workbook formulas without UI.

## Sprint 1 — Authentication, families and approval (target 42 points)

| ID | Pri. | Story | Pts | Acceptance criteria | Depends on |
|---|---:|---|---:|---|---|
| IAM-01 | P0 | Email OTP/magic-link sign-in | 5 | Link opens correct native route; expired/invalid states are safe; session survives restart | Deep-link domains |
| IAM-02 | P0 | Google and Apple sign-in | 8 | Identity linking is tested; Apple option appears on iOS; cancellation and provider failure recover cleanly | Store identities |
| IAM-03 | P0 | Profile and session controls | 3 | Name/locale/timezone editable; sign out device/all devices works; secure storage cleared | IAM-01 |
| FAM-01 | P0 | Create and switch family | 8 | Creation atomically makes Owner/default setup; switching clears/refetches scoped cache | Migrations |
| FAM-02 | P0 | Create/share/revoke invitation | 5 | Raw token returned once; share sheet uses universal link; expiry/use limits enforced | IAM-01 |
| FAM-03 | P0 | Join request and Owner approval | 8 | Requester remains data-blind until approval; approval grants access atomically; rejection works | FAM-02 |
| FAM-04 | P0 | Role and membership management | 5 | Matrix enforced in RLS/RPC/UI; last Owner cannot leave/remove self; removal revokes access promptly | FAM-03 |

Sprint exit: two users complete create → invite → authenticate → request → approve on Android and iOS; all negative RLS tests pass.

## Sprint 2 — Setup, accounts and transaction ledger (target 47 points)

| ID | Pri. | Story | Pts | Acceptance criteria | Depends on |
|---|---:|---|---:|---|---|
| SET-01 | P0 | Family currency, calendar, timezone and notes | 5 | Validation, optimistic conflicts and historical currency warning work | FAM-01 |
| CAT-01 | P0 | Category list/create/edit/archive/reorder | 5 | Income/expense type separation; duplicate normalized name blocked; archived category remains historical | SET-01 |
| CAT-02 | P0 | Category merge | 5 | Preview count/totals; atomic rewrite; audit event; source archived | CAT-01 |
| ACC-01 | P0 | Account list/create/edit/archive | 5 | Beginning balance/date, unlimited accounts, sorting and archive behavior pass | SET-01 |
| TXN-01 | P0 | Unified transaction list and filters | 8 | Keyset pagination; type/date/account/category/member/search filters; accessible rows; 8,000+ fixture performs | CAT-01, ACC-01 |
| TXN-02 | P0 | Add income/expense/adjustment | 8 | Native full-screen form; correct category/amount rules; idempotent double tap; offline draft | TXN-01 |
| TXN-03 | P0 | Edit, conflict, trash and restore | 8 | Role matrix; version conflict resolution; 30-day recoverability; audit history | TXN-02 |
| ACC-02 | P0 | Account totals and reconciliation | 3 | Beginning + income − expense + adjustments matches fixture; discrepancy and optional adjustment explicit | TXN-02 |

Sprint exit: full workbook entry/setup/account parity works, with audit and concurrent-edit protection.

## Sprint 3 — Monthly, annual and custom reports (target 42 points)

| ID | Pri. | Story | Pts | Acceptance criteria | Depends on |
|---|---:|---|---:|---|---|
| RPT-01 | P0 | Canonical report SQL RPCs | 8 | Monthly/annual/custom return schema v1 and reconcile every fixture; zero denominator is null | TXN-02 |
| RPT-02 | P0 | Home summary and quick period navigation | 5 | Current month totals, account balance and recent entries match RPC; stale/offline timestamp shown | RPT-01 |
| RPT-03 | P0 | Monthly report screen | 8 | Totals, ratios, top 20, category distributions, member/account filters and drill-down | RPT-01 |
| RPT-04 | P0 | Annual report screen | 8 | Fiscal/calendar 12-month series, growth, savings, cash flow, category totals/averages | RPT-01 |
| RPT-05 | P0 | Custom range report screen | 5 | Inclusive boundaries, same-day range, invalid order and long-range behavior | RPT-01 |
| RPT-06 | P0 | Accessible chart system | 5 | All 15 workbook chart purposes represented; VoiceOver/TalkBack summaries and data view; no clipped labels | FND-04 |
| RPT-07 | P0 | Realtime report invalidation | 3 | Relevant transaction changes trigger authoritative refetch; unrelated family cannot invalidate/cache | RPT-01 |

Sprint exit: all workbook dashboards reconcile against independent controls on both platforms.

## Sprint 4 — Import, export, notifications and receipts (target 42 points)

| ID | Pri. | Story | Pts | Acceptance criteria | Depends on |
|---|---:|---|---:|---|---|
| IMP-01 | P0 | CSV upload and mapping | 8 | File picker; delimiter/header preview; explicit date/type/amount/account/category mapping | TXN-02 |
| IMP-02 | P0 | Validation, duplicate preview and commit | 8 | Row errors; control totals; deterministic fingerprints; idempotent atomic commit | IMP-01 |
| IMP-03 | P0 | Import rollback | 5 | Unedited batch rolls back; edited conflict produces reviewed choices; totals reconcile | IMP-02 |
| EXP-01 | P0 | Filtered CSV and complete JSON export | 5 | Owner-only full export; short-lived signed URL; request authenticated recently | TXN-01 |
| NOT-01 | P0 | In-app notification center | 3 | Join approval/request/security states; read/unread; no sensitive payload | FAM-03 |
| NOT-02 | P0 | Native push registration and delivery | 5 | Permission requested contextually; token rotation/revocation; tap deep-links to target; physical-device proof | NOT-01 |
| RCP-01 | P1 | Private receipt capture/upload/view/delete | 8 | Camera/library; MIME/size checks; private path policy; signed read; retry and removal | Storage migration |

Sprint exit: users can migrate, export, receive approval notifications and—if P1 capacity remains—attach receipts.

## Sprint 5 — Privacy, quality and store readiness (target 39 points)

| ID | Pri. | Story | Pts | Acceptance criteria | Depends on |
|---|---:|---|---:|---|---|
| SEC-01 | P0 | Complete RLS/grant abuse matrix | 8 | All tables/RPCs test anonymous, wrong-family, pending, removed, viewer/member/admin boundaries | All data stories |
| SEC-02 | P0 | Rate limits and recent-auth gates | 5 | Login, invite, join, export and deletion limits; sensitive operations reject stale auth | IAM-01 |
| PRV-01 | P0 | In-app account/family deletion | 5 | Account deletion route; family 30-day grace/cancel; storage cleanup; clear consequences | FAM-04 |
| QLT-01 | P0 | Maestro critical-path suite | 8 | Auth, family, invite/approval, transaction, reports, import and removal run in release build | Features complete |
| QLT-02 | P0 | Accessibility and device matrix | 5 | VoiceOver/TalkBack, dynamic text, contrast, reduced motion, small phone and tablet smoke | Features complete |
| OPS-01 | P0 | Observability and runbooks | 3 | Redacted crash/log setup; alerts; incorrect-total, auth incident, failed update and restore runbooks | FND-07 |
| STR-01 | P0 | Store metadata/privacy/reviewer mode | 5 | Screenshots, privacy/Data Safety answers, support/privacy URLs and reviewer account complete | Final brand |

Sprint exit: no P0 bug or authorization failure; release candidate is accepted by internal TestFlight and Play tracks.

## Release hardening and pilot (1–2 weeks)

| ID | Pri. | Deliverable | Exit condition |
|---|---:|---|---|
| PIL-01 | P0 | Two-household pilot | Both households finish onboarding, approval, entry, reporting and reconciliation without database intervention |
| PIL-02 | P0 | Workbook control reconciliation | Every source control total and edge fixture matches; discrepancies have signed resolution |
| OPS-02 | P0 | Backup/restore rehearsal | Production-like restore meets documented RPO/RTO and preserves auth-to-family mapping |
| REL-01 | P0 | Store release | Staged rollout, crash/error thresholds healthy, support and rollback owners active |

## Cross-sprint epics and traceability

| Epic | Specification coverage | Primary sprints |
|---|---|---|
| Identity and mobile lifecycle | AUTH, ONB, deep links, secure sessions | 0–1 |
| Family collaboration | invitations, approval, roles, audit | 1, 5 |
| Workbook Setup/Accounts/Income/Expenses/Balance | settings, categories, accounts, transactions, reconciliation | 2 |
| Workbook dashboards and 15 chart purposes | monthly, annual, custom, category summaries | 3 |
| Data portability | CSV import, dedupe, rollback, exports | 4 |
| Native capabilities | push, receipts, share sheet, offline drafts | 1, 2, 4 |
| Security/privacy/reliability | RLS, MASVS, deletion, backups, observability | all, concentrated in 5 |

## Launch blocker policy

The release cannot proceed with: a cross-family access failure; a report variance without documented cause; data loss or duplicate financial mutation; an invitation bypass; an unrecoverable migration; a broken account-deletion route; a critical VoiceOver/TalkBack blocker; or a crash in the create-family, join, add-transaction or report flows.

## Deferred backlog after launch

- P1 receipt completion if not finished in Sprint 4.
- Purpose-built import from the original XLSX template.
- Conflict-safe offline mutation outbox with explicit review UI.
- Recurring transactions and reminders.
- Budget planning and alerts.
- Multiple base currencies/exchange rates.
- Bank/UPI ingestion and reconciliation automation.
- Private transaction partitions only after household-total semantics are redesigned.
