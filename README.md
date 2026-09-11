# FamilyLedger

FamilyLedger is a mobile-first family expense tracker derived from the supplied Excel workbook. It uses Expo/React Native for iOS and Android and Supabase for authentication, PostgreSQL, row-level security, and transactional RPCs.

## Workspace

- `apps/mobile` — Expo SDK 57 mobile application
- `packages/contracts` — shared Zod request contracts
- `packages/domain` — money and reporting domain helpers
- `supabase/migrations` — ordered schema and RPC migrations
- `supabase/tests/database` — database authorization checks
- Product, API, schema, backlog, wireframe, and delivery documents live at the repository root.

## Local setup

1. Copy `.env.example` to `apps/mobile/.env` and add the local or hosted Supabase URL and publishable key.
2. Start Docker Desktop, then run `pnpm db:start` and `pnpm db:reset`.
3. Run `pnpm mobile` and open the development build on Android or iOS.

Quality gate: `pnpm check`. Database gate: `pnpm db:test`.

Never place a Supabase service-role key, store credential, signing key, or SMTP secret in a mobile environment variable.
