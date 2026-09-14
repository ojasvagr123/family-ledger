# Day 2 execution

Started 13 September 2026. Scope: the pilot in THREE_DAY_DEVELOPMENT_AND_DEPLOYMENT_PLAN.md.

## Audit before implementation

- Day 1 has two migrations and 29 recorded database assertions. Android launch was visually verified on 12 September.
- Device authentication, two-session approval, removal/cache clearing, invitation inspection, and signed iOS/Android release checks are not yet fully evidenced.
- Account creation, financial mutations, activity and reports are placeholders at this checkpoint.
- Docker was stopped at the start of this session; restarting the existing installation for project tests.
- Preserve local user accounts/data: apply incremental migrations, do not reset the active local database.

## Work sequence

1. Close Day 1 authentication/guard/invitation gaps and rerun security tests.
2. Implement integer-money account and transaction RPCs with authorization, idempotency, version conflicts and soft deletion.
3. Implement bounded activity, canonical monthly totals, account balances and mobile screens.
4. Add regression fixtures, run lint/typecheck/database checks and Android smoke tests.
5. Record actual results and external release prerequisites. Do not mark untested signed builds complete.

## Implemented through 14 September

- Added migrations 0003–0005: accounts, versioned financial mutations, soft deletion/restoration, bounded ledger queries, canonical monthly reports, invitation inspection, member listing/removal and date/timezone constraints.
- Added Accounts, transaction create/detail/edit/delete, Activity, Home, Monthly Report and family-member screens.
- Money is passed as decimal strings of integer minor units. Conversion avoids binary floating point; aggregate amounts are serialized as text.
- Activity supports type, exclusive date range, account, category and every active family-member filter; 30-row pages, server cap 100, at most ten pages retained by the list. Manual refresh and 15-second foreground-query polling replace Realtime in this pilot.
- Monthly report includes income, expenses, net, both ratios, zero-income explanations, ranked category percentages and accessible bars with text values.
- New transaction drafts can be explicitly saved/restored on the device. Sign-out clears drafts; confirmed membership removal prunes them. No offline financial writes are queued.
- Protected account/family/transaction routes verify active membership. Server RLS remains authoritative. Cached screens show a stale-data notice on connectivity errors.
- Email code verification now complements magic links. Local mail template includes the code; sign-in network errors and callback recovery are handled.
- Family creation and join requests retain retry keys; family settings expose currency/timezone. Owner can remove members.
- Metro and TypeScript exclude preserved dependency backup directories. Metro uses two workers.
- Local Android environment uses `127.0.0.1:54321` through `adb reverse`; this replaces the unreliable emulator host alias observed in device testing.

## Evidence

| Check | Result |
|---|---|
| Local database suite | PASS: 70 assertions, including original 29 Day 1 checks |
| Empty application-schema migration replay | PASS: all five migrations plus database tests; disposable database removed |
| Money/date/role unit tests | PASS: five tests with multiple boundary assertions |
| Real Auth + PostgREST integration | PASS: two QA identities, invitation, pending denial, approval, income, expense, precise detail response, totals and edit denial |
| Local email-code sign-in | PASS: email template delivery and PKCE-compatible code verification |
| TypeScript and ESLint | PASS after final source edits; zero errors and zero warnings |
| Android production JS export | PASS: 1,472 modules, Hermes bundle |
| iOS production JS export | PASS: 1,376 modules, Hermes bundle |
| Android UI smoke | PASS: Home, Activity, Report, Accounts, native create/detail/delete and restored control totals |
| Signed Android/iOS preview distribution | Not completed; EAS/platform credentials and device verification remain required |

Migration replay uses a minimal Auth schema shim for application-schema reproducibility; real Supabase Auth is covered separately by the local integration test. An exported JS bundle is not a signed native binary.

## Local test commands

Run from the repository root:

```powershell
pnpm test
pnpm typecheck
pnpm lint
pnpm db:test
node scripts/verify-migrations.mjs
# Creates clearly named, isolated local QA identities and a QA family:
node scripts/local-integration.mjs
# Starts existing installed development app; first start emulator and Docker:
powershell -File scripts/start-local-android.ps1
```

Local email inbox: `http://127.0.0.1:54324`. Request a code in the app, read it in this inbox and type it into the app. Local email does not go to Gmail.

## Release gates still open

- iOS device plus manual TalkBack/VoiceOver coverage has not yet been verified.
- Credentialed EAS preview binaries and installation smoke tests.
- Production backend, SMTP delivery, permanent identifiers, privacy/support metadata and real invitation domain.
- No production deployment, store submission or `v0.1.0-rc.1` tag has been claimed.
