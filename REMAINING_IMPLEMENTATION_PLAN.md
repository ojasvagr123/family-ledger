# FamilyLedger Remaining Implementation Plan

Last reviewed: 24 September 2026  
Target: Android-first Expo mobile application, with iOS compatibility  
Baseline branch: `codex/three-day-mobile-mvp`  
Baseline commit: `1e77b73` plus the current uncommitted spreadsheet-parity work

## 1. Purpose

This document is the implementation checklist for everything still required to turn FamilyLedger into a production-ready family expense tracker with full functional parity with the source expense-tracker workbook.

The workbook is a product reference only. Spreadsheet-specific mechanics such as editable formulas or worksheet navigation are translated into safe mobile workflows, server-side calculations, role-based permissions, and accessible mobile visualizations.

Status meanings:

- `READY`: requirements and dependencies are known; implementation can begin.
- `PARTIAL`: a schema, API, or basic screen exists, but the complete user workflow is unfinished.
- `BLOCKED`: external access, credentials, or a product decision is required.
- `DONE`: implemented, verified, and available through the mobile UI.

## 2. Current Implemented Baseline

The following capabilities already exist in the working tree and are not part of the remaining scope:

- Email magic-link/OTP authentication and deep-link callback.
- Family creation, family switching, invitation creation/sharing/revocation, join requests, approval and rejection.
- Owner/Admin/Member/Viewer authorization enforced by database RPCs and mobile UI.
- Account creation with type, opening date, beginning balance, computed balance, deposits, withdrawals and adjustments.
- Income and expense creation, viewing, editing, soft deletion, drafts, idempotency and optimistic concurrency.
- Positive and negative account balance adjustments.
- Transaction filtering by type, date, account, category and member, with keyset pagination.
- Monthly income, expense, net savings, savings rate, expense-to-income ratio and category ranking.
- Fiscal annual-report and custom-date-report database contracts and initial mobile screens.
- Category creation and archival.
- Account reconciliation using actual balance, checked date and calculated difference.
- Paste-based CSV preview/import.
- Help and FAQ screen.

Workbook-parity migrations `0006_spreadsheet_parity.sql` and `0007_verified_workbook_parity.sql` are applied locally and replay successfully from an empty application schema. The Android development client has also been rebuilt and runtime-verified.

## 3. Priority Summary

| ID | Feature group | Priority | Current status | Main dependency |
|---|---|---:|---|---|
| DB-01 | Replay and validate migrations 0006–0007 | P0 | DONE | Verified locally |
| DB-02 | Database tests for new RPCs and authorization | P0 | DONE | 115 assertions pass |
| CAT-01 | Rename and reorder categories | P0 | DONE | Runtime route + database migration verified |
| CAT-02 | View and restore archived categories | P1 | DONE | Runtime route + database migration verified |
| ACC-01 | Edit account name and type | P0 | DONE | Runtime route + database migration verified |
| ACC-02 | View and restore archived accounts | P1 | DONE | Runtime route + database migration verified |
| ACC-03 | Account dashboard totals and reconciliation status | P1 | DONE | Android control totals verified |
| SET-01 | Edit family name, currency symbol/code, timezone and fiscal settings | P0 | DONE | Android route + RPC regression verified |
| TRF-01 | Linked account transfers | P0 | DONE | Atomic paired adjustments, audit event and mobile flow verified |
| TXN-01 | Deleted transaction list and restore | P1 | DONE | Soft-delete smoke + trash route verified |
| TXN-02 | Search and selectable sorting | P1 | DONE | Activity search/sort route verified |
| REP-01 | Complete monthly dashboard visualizations | P0 | DONE | On-device charts inspected |
| REP-02 | Complete annual dashboard tables and visualizations | P0 | DONE | Annual route/data/charts/matrices verified |
| REP-03 | Complete custom dashboard visualizations | P0 | DONE | Same-day RPC regression + Android route verified |
| REP-04 | Reporting-period picker and fiscal coverage preview | P1 | DONE | Monthly/annual/custom selectors and settings preview available |
| CSV-01 | Native CSV file picker and mapping | P1 | DONE | Native module linked; import route renders on Android |
| CSV-02 | Duplicate detection and import history | P1 | DONE | Fingerprints, preview, batch history and rollback implemented |
| MEM-01 | Change member roles | P0 | DONE | Owner-only RPC and Android member route verified |
| MEM-02 | Leave family and transfer ownership | P1 | DONE | Locked ownership transfer, leave flow and notifications implemented |
| RT-01 | Realtime cross-device synchronization | P1 | DONE | Family-scoped Postgres-change invalidation with polling fallback |
| NOTE-01 | Family financial notes | P2 | DONE | Versioned shared notes and permission-aware editor implemented |
| EXP-01 | Export transactions and reports | P2 | DONE | Filtered transaction and monthly/annual/custom CSV sharing implemented |
| DEMO-01 | Demo family/sample data | P2 | DONE | Isolated idempotent seed RPC and onboarding action verified |
| A11Y-01 | Accessibility and device-size audit | P0 | READY | Final screens available |
| REL-01 | Production environment, signed builds and store release | P0 | BLOCKED | Supabase/EAS/store credentials |

## 4. Detailed Workstreams

### 4.1 Database validation and contract completion

#### DB-01 — Replay migration 0006

Scope:

- Apply `supabase/migrations/0006_spreadsheet_parity.sql` to a clean local database.
- Confirm all functions compile and grants use the correct signatures.
- Confirm migration replay works both from an empty database and from migration 0005 state.
- Regenerate TypeScript database types after successful replay.

Verification commands:

```powershell
.\node_modules\.bin\supabase.CMD db reset --local
.\node_modules\.bin\supabase.CMD test db
node scripts/verify-migrations.mjs
```

Acceptance criteria:

- All six migrations apply without warnings or SQL errors.
- Existing day-one and day-two database tests remain green.
- Generated database types include every new function and column.
- No anonymous user can call financial or management RPCs.

#### DB-02 — New database tests

Create `supabase/tests/database/spreadsheet_parity.sql` covering:

- Owner/Admin category creation, rename, reorder, archive and restore.
- Member/Viewer rejection for category and account administration.
- Signed adjustment creation and balance effect.
- Adjustment exclusion from income/expense reports.
- Account reconciliation storage and authorization.
- Annual fiscal-year boundaries for January and non-January starts.
- Inclusive custom-report end date.
- Account totals for deposits, withdrawals and adjustments.
- Idempotency replay and mismatched-payload rejection.
- Cross-family isolation for every new RPC.

### 4.2 Category administration

#### CAT-01 — Rename and reorder categories

Database/API:

- Use the existing `update_category` RPC.
- Add optional batch reorder RPC so an entire category order updates atomically.
- Enforce unique active names per family and type.

Mobile UI:

- Add Edit action beside each active category.
- Provide name field with current value.
- Provide Move Up/Move Down controls initially; drag-and-drop can follow if needed.
- Invalidate category, transaction-form and report queries after changes.

Acceptance criteria:

- Owner/Admin can rename and reorder categories.
- Member and Viewer never see administration actions.
- Renaming preserves historical transactions and report grouping.
- Duplicate normalized names show a friendly error.

#### CAT-02 — Archived category management

- Extend category listing to optionally include archived records.
- Add an Archived section with Restore action.
- Historical transactions must continue displaying the archived category name.
- Archived categories must not appear in new transaction pickers.

### 4.3 Account administration and reconciliation

#### ACC-01 — Edit accounts

- Expose the existing `update_account` RPC through the Accounts screen.
- Allow Owner/Admin to change account name and account type.
- Do not allow opening date or beginning balance changes after transactions exist; use adjustments instead.
- Display duplicate-name and concurrency errors clearly.

Acceptance criteria:

- Renaming an account preserves all linked transactions.
- Updated names appear immediately in activity and filters.
- Viewers and Members cannot edit account configuration.

#### ACC-02 — Archived accounts

- Add an RPC/list mode for archived accounts.
- Add Archived Accounts section with Restore action.
- Warn before archival when the account has a non-zero balance.
- Prevent the final active account from being archived while active transactions still require an account.

#### ACC-03 — Account dashboard completeness

- Add family-wide totals for beginning balance, deposits, withdrawals, adjustments and current balance.
- Add reconciliation states: Never checked, Reconciled, Difference found and Stale.
- Add account-detail screen with related transactions and last reconciliation.
- Avoid converting bigint money through JavaScript `Number`; format from strings throughout.

### 4.4 Linked transfers

#### TRF-01 — Transfer workflow

The spreadsheet approximates transfers using two balance adjustments. The mobile app should provide a safer linked workflow.

Database design:

- Add `transfers` table containing family, source account, destination account, local date, amount, description, remarks, creator, version and deleted timestamp.
- Add two linked adjustment transactions or a transfer-aware balance calculation.
- Add unique request/idempotency handling so both sides commit atomically.
- Prevent source and destination from being the same account.
- Require a positive transfer amount.

API contracts:

- `save_transfer`
- `set_transfer_deleted`
- `get_transfer`
- `list_transfers`

Mobile UI:

- Add Transfer as a fourth Add flow beside Income, Expense and Balance Adjustment.
- Select From account and To account.
- Show both balance effects before confirmation.
- Edit/delete the transfer as one unit.

Acceptance criteria:

- Transfer decreases the source and increases the destination by exactly the same amount.
- Family total balance is unchanged.
- Transfer does not affect income, expense, savings or category reports.
- Partial transfer writes are impossible.

### 4.5 Transaction history completion

#### TXN-01 — Trash and restore

- Extend transaction listing with `deleted_only` or `include_deleted` mode.
- Add Trash screen under More.
- Show deletion date, transaction type, amount and creator.
- Restore through existing `set_transaction_deleted` RPC using current version.
- Add permanent purge only if a later retention policy explicitly requires it.

#### TXN-02 — Search and sorting

- Add normalized search across description, remarks, category and account names.
- Add database indexes suitable for family-scoped text search.
- Add sort choices: newest, oldest, highest amount, lowest amount, category and account.
- Preserve filters when opening a transaction and returning to Activity.

### 4.6 Family settings

#### SET-01 — Editable family settings

Database/API:

- Add `update_family_settings` RPC with optimistic version check.
- Editable fields: family name, ISO currency code, timezone, fiscal start month and reporting start year.
- Audit previous and new settings.
- Validate IANA timezone, ISO-style three-letter currency and supported year range.

Mobile UI:

- Add Family Settings screen for Owner/Admin.
- Replace numeric fiscal month input with a month selector.
- Add currency picker showing code and symbol preview.
- Add timezone picker/search.
- Show a three-year fiscal coverage preview matching the workbook Setup sheet.

Acceptance criteria:

- Changed fiscal month immediately affects annual-report boundaries.
- Currency changes affect display only and never reinterpret stored minor amounts.
- Concurrent settings edits return a version-conflict message.

### 4.7 Reporting and visualizations

#### Shared chart foundation

Create reusable accessible components:

- `ComparisonBarChart`
- `DoughnutChart`
- `PieChart`
- `AreaTrendChart`
- `MonthlyComboChart`
- `HorizontalRankingChart`
- `ChartLegend`
- `AccessibleChartSummary`

Every chart must provide a text/table alternative for TalkBack and VoiceOver. Colors cannot be the only way values are distinguished.

#### REP-01 — Monthly dashboard

Complete workbook equivalents:

1. Income vs Expense bar chart.
2. Expense as Percentage of Income doughnut.
3. Savings-rate positive/negative status treatment.
4. Income Distribution doughnut.
5. Expense Distribution doughnut.
6. Separate Top 20 Income and Top 20 Expense tables.
7. Full category-summary sections with zero-value display toggle.
8. Direct month/year picker in addition to Previous/Next.

#### REP-02 — Annual dashboard

Complete workbook equivalents:

1. Annual Income vs Expense comparison.
2. Expense as Percentage of Income doughnut.
3. Income Growth area chart.
4. Savings Trend bar chart.
5. Monthly Income/Expense/Net combination chart.
6. Income Breakdown pie chart.
7. Expense Breakdown pie chart.
8. Twelve-month overview table.
9. Cash-flow totals, monthly averages and savings rates.
10. Income and expense category matrices with total, average and twelve month columns.
11. Separate annual Top 20 income and expense rankings.

The annual-report RPC should return category-by-month matrices rather than forcing the client to derive them from multiple calls.

#### REP-03 — Custom dashboard

Complete workbook equivalents for an inclusive start/end period:

1. Income vs Expense comparison.
2. Expense as Percentage of Income doughnut.
3. Income Distribution doughnut.
4. Expense Distribution doughnut.
5. Separate Top 20 income and expense tables.
6. Full category summaries.
7. Quick presets for Today, This week, This month, Quarter, Six months and Fiscal year.

#### REP-04 — Reporting navigation

- Replace separate unstructured routes with a Reports landing screen containing Monthly, Annual and Custom choices.
- Retain the selected reporting period when moving between report screens.
- Add fiscal-period explanation and coverage preview.

### 4.8 CSV and data portability

#### CSV-01 — Native file import

- Add Expo Document Picker using the SDK-compatible package version.
- Read UTF-8 CSV files without requiring copy/paste.
- Detect delimiters and quoted/multiline fields.
- Add column-mapping screen for bank exports with different headers.
- Support date-format choice for ambiguous dates.
- Allow per-row account/category correction before import.
- Submit imports in bounded batches with progress and cancellation.

#### CSV-02 — Duplicate protection

- Calculate a stable import fingerprint from family, date, amount, type, account and normalized description.
- Show Exact duplicate, Possible duplicate and New statuses.
- Default to skipping exact duplicates.
- Store import batches and row outcomes for later review.

#### EXP-01 — Export

- Export filtered transactions as CSV.
- Export monthly/annual/custom report summaries as CSV.
- Use the native share sheet.
- Ensure adjustment and transfer rows are distinguishable.

### 4.9 Member and family lifecycle

#### MEM-01 — Role management

- Add owner-only `change_member_role` RPC.
- Owner can assign Admin, Member or Viewer.
- Owner cannot demote themself without first transferring ownership.
- Prevent removing or demoting the only Owner.
- Add confirmation text explaining each role.

#### MEM-02 — Leave family and ownership transfer

- Members/Admins/Viewers may leave a family.
- Owner must transfer ownership before leaving.
- Add `transfer_family_ownership` RPC with row locking and audit events.
- Preserve historical transaction creator attribution after departure.

### 4.10 Realtime and offline behavior

#### RT-01 — Realtime synchronization

- Subscribe to family-scoped changes for transactions, accounts, categories, memberships and join requests.
- Invalidate the smallest affected React Query keys.
- Retain 15-second polling as a fallback only when realtime is disconnected.
- Display offline/stale state without blocking local draft creation.

Future offline scope:

- Queue transaction writes locally.
- Preserve idempotency keys across retries.
- Surface conflicts for explicit resolution.

### 4.11 Notes, demo data and guidance

#### NOTE-01 — Family financial notes

- Add family-scoped notes with author and update timestamp.
- Owner/Admin can edit shared notes; all active members can read.
- Keep notes outside financial calculations.

#### DEMO-01 — Sample family

- Add opt-in demo data during family creation.
- Seed accounts, categories and transactions across multiple months.
- Clearly label demo data and provide one-step removal.

### 4.12 Accessibility, quality and release

#### A11Y-01 — Accessibility audit

- TalkBack on Android and VoiceOver on iOS.
- Dynamic font sizes and text wrapping.
- Minimum touch targets.
- Screen-reader labels for values, controls and charts.
- Color contrast and non-color status indicators.
- Small-phone, medium-phone and tablet layouts.
- Keyboard avoidance and scrolling for every form.

#### Test suite completion

- Domain unit tests for fiscal dates, money, CSV parsing and report ratios.
- Component tests for forms, permissions, loading, error and empty states.
- Database pgTAP tests for every new RPC.
- Android emulator smoke tests for each primary flow.
- iOS export/build verification.
- Large-data tests covering at least 10,000 transactions.
- Regression checks for cross-family data isolation.

#### REL-01 — Production release

External requirements:

- Production Supabase project and secrets.
- Production invitation domain/universal links.
- Expo/EAS project credentials.
- Android package name, signing keystore and Play Console access.
- Apple bundle identifier, certificates and App Store Connect access for iOS.
- Privacy policy, terms, support URL, store screenshots and data-safety answers.

Release gates:

- Clean production migration replay.
- Backup and rollback plan.
- No critical or high security findings.
- Successful signed internal Android build.
- Successful signed iOS build when iOS release is in scope.
- Manual acceptance test by Owner, Member and Viewer accounts.

## 5. Recommended Build Order

### Phase 1 — Stabilize the parity migration

1. Apply migration 0006.
2. Fix any PostgreSQL errors.
3. Add pgTAP coverage.
4. Regenerate database types.
5. Run existing integrations and Android smoke tests.

### Phase 2 — Finish management workflows

1. Category rename/reorder/restore.
2. Account edit/archive/restore and aggregate totals.
3. Family settings and fiscal coverage preview.
4. Member role management.

### Phase 3 — Finish ledger workflows

1. Linked transfers.
2. Trash and restore.
3. Search and sorting.
4. CSV file picker, mapping and duplicate detection.

### Phase 4 — Complete reporting parity

1. Shared accessible chart components.
2. Monthly chart/table completion.
3. Annual matrix and all annual charts.
4. Custom-period presets and charts.
5. Cross-report navigation and period persistence.

### Phase 5 — Production readiness

1. Realtime synchronization.
2. Accessibility/device audit.
3. Performance and large-data testing.
4. Production backend migration.
5. Signed Android/iOS builds and store preparation.

## 6. Definition of Done for Each Feature

A feature is complete only when all of the following are true:

- Database changes are additive, replayable and covered by authorization tests.
- API inputs are validated both client-side and server-side.
- Cross-family access is impossible.
- Mobile UI covers loading, empty, success, validation, permission and retry states.
- Money never passes through floating-point arithmetic.
- Writes are idempotent and audited where financially material.
- TypeScript and ESLint pass without warnings.
- Android flow is exercised on an emulator.
- Documentation and this checklist are updated.
- No unrelated user files or machine settings are changed.

## 7. Implementation Progress After This Plan Was Created

Completed in the current working tree:

1. Category rename with normalized duplicate-name handling.
2. Atomic category reordering through Move Up/Move Down controls and `reorder_categories`.
3. Account name/type editing through `update_account`.
4. Family Settings screen for family name, currency, timezone, fiscal start month and reporting start year.
5. Three-year fiscal coverage preview matching the workbook's fiscal-year convention.
6. `get_family_settings` and optimistic `update_family_settings` RPCs with audit events.
7. Shared validation schemas for category, account and family-settings updates.
8. TypeScript, ESLint, domain tests and diff validation completed successfully.
9. Transaction Trash screen with deletion metadata, creator display and permission-aware restore.
10. Family-scoped `list_deleted_transactions` RPC capped at 200 records.
11. Owner-only member role management for Admin, Member and Viewer with confirmation text and audit history.
12. Archived-category listing and restore workflow, isolated from active transaction-entry choices.
13. Reusable SVG report charts with screen-reader summaries and text/table alternatives.
14. Monthly workbook parity: direct month/year selection, comparison and ratio charts, income/expense distributions, Top 20 rankings, and optional zero-value category rows.
15. Annual workbook parity: fiscal coverage selector, seven chart-equivalent views, twelve-month overview, totals and averages, and category-by-month matrices.
16. Custom-dashboard parity: inclusive date ranges, six quick-period presets, four chart-equivalent views, Top 20 rankings and full category summaries.
17. Accounts dashboard totals, reconciliation states, non-zero archive warning, final-active-account protection, archived-account listing and restore.
18. Transaction search across description, remarks, category and account, with six sorting modes and retained screen filters.
19. Updated in-app Help content for fiscal years, report controls, Activity filtering, balance corrections and transaction restoration.
20. Native CSV document selection with automatic delimiter/header detection and configurable column mapping.
21. CSV date-order selection, quoted/multiline parsing, default account/category mapping, 500-row preview limit, progress and cancellation.
22. Domain tests expanded to cover CSV delimiter, quoting, multiline values and date normalization.
23. Custom family currency symbol persisted and used by every money display.
24. Annual workbook distributions rendered as pie charts while monthly/custom distributions remain doughnuts.
25. All positive category slices rendered rather than grouping categories into an artificial “Other” bucket.
26. Same-day custom reports enabled and covered by a regression test.
27. Migrations 0001–0007 replayed cleanly and applied to local Supabase.
28. Database authorization, ledger, workbook-parity and product-completion suites pass all 115 assertions.
29. Android native client rebuilt, installed and verified across every workbook-parity route.
30. Android control-total, chart-rendering and transaction create/delete smoke tests pass.

All items previously marked `PARTIAL` for workbook parity are now `DONE`.

All substantial workbook-originated workflows are implemented and runtime-verified. The former CSV-02, TRF-01, MEM-02, RT-01, NOTE-01, EXP-01 and DEMO-01 enhancement gaps are also implemented. The current repository additionally includes profile/session management, member suspension/restoration, invitation identity previews, in-app notifications, category colors/merge/unused deletion, richer account metadata, account-detail ledgers, reconciliation history, amount/deletion filters, payer/receiver attribution and transaction duplication. Remaining work is limited to explicitly deferred scope (receipt attachments, recurring templates and conflict-safe offline writes), full accessibility/device certification, production credentials, signed iOS/Android builds and store submission.
