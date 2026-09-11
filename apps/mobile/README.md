# FamilyLedger mobile

Native Expo SDK 57 application for iOS and Android.

## Local setup

1. Copy the repository `.env.example` to `.env` and provide the public Supabase URL/key and invite origin.
2. From the repository root, run `pnpm install`.
3. Start Docker Desktop, then run `pnpm db:start` and `pnpm db:reset`.
4. Run `pnpm start`; use a development build for native auth/deep-link testing.

The service-role key and signing/provider secrets must never use `EXPO_PUBLIC_` or enter this repository.

## Current Day 1 surface

- passwordless email sign-in and PKCE callback;
- secure session persistence;
- create/switch family;
- invitation creation and native share sheet;
- accept invite and pending-approval route;
- Owner/Admin request review;
- native Home, Activity, Reports, and More shell;
- executable Supabase migrations and default-deny RLS.

Transaction and reporting screens are intentionally marked for Day 2.
