# FamilyLedger pilot release checklist

## Local readiness

- [x] Authenticated Owner/Member API integration and pending denial
- [x] RLS and financial control totals
- [x] Incremental migrations applied without resetting existing local data
- [x] Empty application-schema migration replay
- [x] Money/date regression tests
- [x] Android and iOS JavaScript bundle exports
- [x] Android native critical flow (Home, Activity, Report, Accounts, create/detail/delete)
- [x] Product-completion and sample-family migration replay with 115 database assertions
- [x] Modern mobile design system, dashboard and navigation smoke-tested on Android
- [x] Atomic transfers, ownership/member lifecycle, notes, realtime invalidation and notifications
- [x] Duplicate-safe CSV import batches with history and rollback
- [x] Transaction and report CSV sharing
- [x] Idempotent sample-family onboarding with representative accounts and transactions
- [x] All 14 major Android routes and financial control totals verified after the UI refresh
- [x] Final source validation after all patches
- [ ] Manual TalkBack and VoiceOver accessibility smoke

## External release prerequisites

- [ ] Confirm permanent app IDs (currently `com.familyledger.app`)
- [ ] Expo/EAS login, project ID and signing credentials
- [ ] Production Supabase project, exact redirects and email delivery
- [ ] HTTPS invitation domain or documented native-scheme pilot fallback
- [ ] Privacy policy, support email, legal owner and store disclosures
- [ ] Android preview binary installed and tested
- [ ] iOS preview binary installed and tested
- [ ] Play internal testing/TestFlight distribution

Do not reset the production database. Apply numbered migrations with a backup and verify RLS before switching the application to production. Local `.env` values and development signing keys are not production configuration.

Rollback: retain the prior signed binary and previous server-compatible release. Prefer a forward corrective migration over dropping tables or removing transaction data. Never undo a production financial migration without a reviewed data-preserving recovery plan.
