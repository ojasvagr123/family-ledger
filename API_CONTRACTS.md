# FamilyLedger Mobile — API Contracts

This contract is client-facing and versioned as `v1`. Inputs and outputs are defined as Zod schemas in `packages/contracts`; generated Supabase database types are an implementation detail, not the public domain contract.

## 1. Conventions

- Auth: Supabase bearer session. Anonymous access is limited to auth and opaque invitation inspection.
- Tenant: every operation takes `familyId`, then verifies it against `auth.uid()`; membership is never inferred from client state.
- Dates: `YYYY-MM-DD`. Timestamps: UTC RFC 3339. Timezone: IANA name.
- Money: integer minor units serialized as decimal strings at the network boundary to avoid JavaScript integer overflow, e.g. `{ "amountMinor": "125050", "currency": "INR" }`.
- Pagination: keyset cursor, never unbounded offset pagination for ledgers/audit.
- Idempotency: mutation field `idempotencyKey` is a UUID. Reuse with different input returns `IDEMPOTENCY_CONFLICT`.
- Concurrency: update/delete/restore requests include `expectedVersion`.
- Responses: `{ "data": ..., "meta": { "requestId": "uuid", "schemaVersion": 1 } }`.

```ts
type ApiError = {
  error: {
    code: 'AUTH_REQUIRED' | 'MEMBERSHIP_REQUIRED' | 'FORBIDDEN'
      | 'VALIDATION_FAILED' | 'NOT_FOUND' | 'VERSION_CONFLICT'
      | 'IDEMPOTENCY_CONFLICT' | 'RATE_LIMITED'
      | 'INVITE_EXPIRED' | 'INVITE_REVOKED' | 'INVITE_EXHAUSTED'
      | 'OWNER_REQUIRED' | 'LAST_OWNER' | 'IMPORT_INVALID'
      | 'OFFLINE_REQUIRED_ACTION' | 'INTERNAL';
    message: string;
    requestId: string;
    fieldErrors?: Record<string, string[]>;
    retryAfterSeconds?: number;
    current?: unknown;
  };
};
```

## 2. Read contracts

Simple reads use the Supabase data API under RLS through typed repository functions. The mobile client never builds arbitrary filters.

### 2.1 Families

`listFamilies()` returns active memberships only:

```ts
type FamilySummary = {
  id: string; name: string; currencyCode: string; timezone: string;
  fiscalStartMonth: number; role: 'OWNER'|'ADMIN'|'MEMBER'|'VIEWER';
  memberCount: number; version: number;
};
```

`getFamily(familyId)` returns settings, caller role/capabilities and deletion state.

### 2.2 Transactions

`listTransactions(input)`:

```ts
type ListTransactionsInput = {
  familyId: string;
  cursor?: string;
  limit?: number;                 // default 50, maximum 100
  start?: string;
  endInclusive?: string;
  types?: ('INCOME'|'EXPENSE'|'ADJUSTMENT')[];
  accountIds?: string[];
  categoryIds?: string[];
  memberIds?: string[];
  createdByIds?: string[];
  search?: string;                // 2..100 chars after trim
  includeDeleted?: boolean;       // Owner/Admin only
  sort?: 'DATE_DESC'|'DATE_ASC'|'AMOUNT_DESC'|'AMOUNT_ASC';
};

type TransactionRecord = {
  id: string; familyId: string; type: 'INCOME'|'EXPENSE'|'ADJUSTMENT';
  localDate: string; amountMinor: string; currencyCode: string;
  account: { id: string; name: string };
  category: { id: string; name: string; color?: string } | null;
  relevantMember: { id: string; displayName: string } | null;
  description: string; remarks: string;
  createdBy: { id: string; displayName: string };
  updatedBy: { id: string; displayName: string };
  attachmentCount: number; imported: boolean;
  version: number; createdAt: string; updatedAt: string; deletedAt?: string;
  capabilities: { canEdit: boolean; canDelete: boolean; canRestore: boolean };
};
```

Response contains `items`, `nextCursor` and filter echo. A cursor is invalid if reused with different normalized filters.

### 2.3 Accounts

`listAccounts({ familyId, asOf, includeArchived })` returns beginning balance, deposits, withdrawals, adjustments, current balance and last reconciliation. Totals are server-calculated.

### 2.4 Reports

All report RPCs return:

```ts
type ReportV1 = {
  schemaVersion: 1;
  familyId: string;
  period: { start: string; endInclusive: string; timezone: string; label: string };
  filters: { accountIds: string[]; memberIds: string[] };
  totals: {
    incomeMinor: string; expenseMinor: string; netMinor: string;
    expenseToIncome: number | null; savingsRate: number | null;
  };
  incomeCategories: CategoryMetric[];
  expenseCategories: CategoryMetric[];
  topIncome: CategoryMetric[];       // maximum 20
  topExpenses: CategoryMetric[];     // maximum 20
  series: Array<{
    periodStart: string; label: string;
    incomeMinor: string; expenseMinor: string; netMinor: string;
  }>;
  accountCashFlow: Array<{
    accountId: string; accountName: string;
    depositsMinor: string; withdrawalsMinor: string; adjustmentsMinor: string;
  }>;
  calculatedAt: string;
  dataVersion: string;
};
```

`CategoryMetric` contains ID, name, amount, percentage (`null` for zero denominator), rank and average-per-month where relevant. Stable ties use normalized category name then category ID.

## 3. Domain RPCs

RPC names are snake_case in PostgreSQL; TypeScript wrappers are camelCase.

### 3.1 Family lifecycle

#### `create_family`

Input: `name`, `currencyCode`, `timezone`, `fiscalStartMonth`, `reportingStartYear`, `defaultPreset`, `idempotencyKey`.

Atomic effects: create family; create active Owner membership; add default categories; set active family preference; write audit event. Returns `FamilySummary`.

#### `update_family_settings`

Owner/Admin; input includes `familyId`, mutable settings, `expectedVersion`, `idempotencyKey`. Currency changes after transactions exist require `confirmHistoricalDisplayChange: true`; no conversion occurs.

#### `transfer_ownership`

Owner only with recent authentication. Target must be active. Atomically changes previous Owner to Admin, target to Owner, and `families.owner_user_id`. Never permits zero or two owners.

#### `request_family_deletion` / `cancel_family_deletion`

Owner only with recent authentication. First call sets deletion effective time to 30 days; cancellation clears it. Scheduled deletion removes storage then database rows and records an operational tombstone.

### 3.2 Invitations and membership

#### `create_invitation`

Owner/Admin. Input: `familyId`, `expiresInHours` (1..168), `maxUses` (1..20), `idempotencyKey`. Returns raw token exactly once plus share URL and expiry. Database stores only SHA-256 hash.

#### `inspect_invitation`

Accepts opaque token and returns only family display name, inviter display name and validity. It never reveals members or financial data.

#### `request_join`

Authenticated. Consumes a valid token use atomically, creates/returns one pending request, and notifies Owner/Admin. It does not create active access.

#### `decide_join_request`

Owner/Admin. Input: `familyId`, `joinRequestId`, `decision`, `idempotencyKey`. Approval creates or activates membership atomically; rejection reveals no financial data to the requester.

#### `update_member_role`, `suspend_member`, `remove_member`, `leave_family`

All enforce the role matrix and last-owner invariant. Removing a member immediately invalidates their family cache through a membership Realtime event and subsequent server rejection.

### 3.3 Transactions

#### `create_transaction`

```ts
type CreateTransactionInput = {
  familyId: string;
  type: 'INCOME'|'EXPENSE'|'ADJUSTMENT';
  localDate: string;
  amountMinor: string;
  accountId: string;
  categoryId?: string;
  relevantMemberId?: string;
  description?: string;
  remarks?: string;
  idempotencyKey: string;
};
```

Rules: contributor role; active same-family account; matching active category for income/expense; no category for adjustment; positive amount for income/expense; non-zero signed amount for adjustment; business date on/after account opening date unless Admin/Owner explicitly confirms.

#### `update_transaction`

Same shape plus `transactionId` and `expectedVersion`. Member may update own record only; Owner/Admin any record. Returns `VERSION_CONFLICT` with current record if version changed.

#### `soft_delete_transaction` / `restore_transaction`

Same permissions as edit. Restore allowed for 30 days and only when referenced category/account can still be resolved. Server returns a recoverability error with remediation if not.

#### `bulk_mutate_transactions`

Owner/Admin only, maximum 100 IDs. Supported actions: recategorize, move account, soft-delete. Entire request is atomic and returns affected versions.

### 3.4 Categories/accounts/reconciliation

- `upsert_category`: Owner/Admin; normalized active name uniqueness per type.
- `archive_category`: prevents new usage; existing transactions retain history.
- `merge_categories`: previews count/totals, then atomically rewrites transactions, archives source and audits before/after.
- `upsert_account`: Owner/Admin; opening balance/date and optimistic version.
- `archive_account`: blocked if referenced by a pending import; historical reports remain available.
- `reconcile_account`: snapshots expected and actual balances; optional adjustment is a separate explicitly confirmed transaction in the same database transaction.

### 3.5 Import/export

- `create-import-preview` Edge Function: accepts signed upload reference and mapping; returns validation summary and preview cursor.
- `commit_import` RPC: input batch ID, selected rows, expected validation version and idempotency key; atomic transaction insert.
- `rollback_import` RPC: succeeds only when created rows are unchanged or the caller supplies reviewed conflict choices.
- `request-export` Edge Function: creates an asynchronous job, emits in-app/push completion, and returns a short-lived signed download URL. Export formats: filtered CSV and complete family JSON; XLSX is P1.

## 4. Edge Function HTTP contracts

Base path: `/functions/v1/<name>`. All responses use the common envelope and `x-request-id`.

| Function | Method | Authorization | Purpose |
|---|---|---|---|
| `send-invitation` | POST | Owner/Admin | Send or resend invite email after RPC creates token |
| `send-push` | POST/internal | service or verified webhook | Fan out approved notification templates to active installations |
| `create-import-preview` | POST | Contributor | Stream/parse private CSV into staging rows |
| `request-export` | POST | Owner | Create privacy-safe export job |
| `cleanup-expired-data` | POST/cron | service | Expire tokens/idempotency rows and purge deletion-retention records |

Functions validate the bearer token themselves, apply request-size limits, verify content type, and never accept a caller-supplied role.

## 5. Realtime events

Subscriptions are scoped to the active family and only these channels are enabled:

- `membership_changed`: forces membership refetch; removal clears local family cache immediately.
- `transaction_changed`: invalidates affected transaction list, account summary and intersecting report periods.
- `settings_changed`: invalidates family, categories or accounts.
- `notification_created`: refreshes the current user’s notification inbox.

Payloads contain IDs, event type, version and coarse affected period only. They do not duplicate descriptions, remarks, receipts or computed totals.

## 6. Deep-link contracts

Canonical HTTPS paths:

- `/invite/<opaqueToken>`
- `/auth/callback`
- `/account/reset-password`

Native routes accept a token, preserve it through authentication, and then call `inspect_invitation`/`request_join`. If the app is not installed, the HTTPS fallback shows only store buttons and preserves the opaque token through a short-lived server cookie or post-install entry flow. Raw tokens are removed from analytics and application logs.

## 7. Contract test matrix

For every operation test: anonymous, correct active role, wrong family, pending, suspended, removed, viewer write, member editing another member, Admin attempting owner-only operation, expired token, duplicate idempotency key and stale version. Report tests reconcile seeded raw rows across all fiscal start months, leap day, timezone boundaries, zero income, negative net, more than 8,000 rows and stable ranking ties.
