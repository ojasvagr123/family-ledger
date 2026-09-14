# FamilyLedger pilot release checklist

## Local readiness

- [x] Authenticated Owner/Member API integration and pending denial
- [x] RLS and financial control totals
- [x] Incremental migrations applied without resetting existing local data
- [x] Empty application-schema migration replay
- [x] Money/date regression tests
- [x] Android and iOS JavaScript bundle exports
- [x] Android native critical flow (Home, Activity, Report, Accounts, create/detail/delete)
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
