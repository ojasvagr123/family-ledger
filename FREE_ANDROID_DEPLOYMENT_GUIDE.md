# FamilyLedger: Free Android Deployment Guide

Last verified: 25 September 2026
Application: FamilyLedger, Expo SDK 57 / React Native / Supabase  
Primary target: installable Android APK for family members and pilot testers

## Deployment progress

Status recorded on 25 September 2026:

- [x] Step 1 — Local release gate completed.
- [x] Step 2 — Production Supabase project created, linked, and migrations deployed.
- [x] Step 3 — Production authentication URLs, email template, and custom SMTP configured.
- [ ] Step 4 — Connect the mobile application to the production Supabase URL and publishable key.
- [ ] Step 5 — Initialize/link the Expo EAS project.
- [ ] Step 6 — Configure the five EAS `preview` environment variables.
- [ ] Step 7 — Build and download the signed Android preview APK.
- [ ] Step 8 — Complete two-device acceptance testing and distribute the private pilot.

The next active task is [Section 8](#8-collect-the-public-supabase-app-values). Before starting the cloud build, also verify the RLS-enabled production tables and send one real authentication email to a non-team address.

## 1. What “free deployment” means

The recommended zero-cost deployment is:

```text
Local source code
      |
      +--> Supabase Free project (database, authentication, realtime)
      |
      +--> Expo EAS Free build (signed Android APK)
                            |
                            +--> private installation link for family/testers
```

This route does not require Google Play or Apple App Store accounts.

| Component | Free route | Important limit |
|---|---|---|
| Android build | Expo EAS Free plan | Currently includes up to 15 Android builds per month in a low-priority queue |
| Android distribution | EAS internal build link or manually shared APK | Users must allow installation from the browser/files app |
| Backend | Supabase Free plan | Free projects can pause after one week of inactivity and do not include managed daily backups |
| Authentication email | Free SMTP allowance from a provider such as Brevo or Resend | Provider limits and sender verification apply |
| Google Play Store | Not free | Google charges a one-time USD 25 developer registration fee |
| Apple App Store/TestFlight | Not free for normal distribution | Apple Developer Program is USD 99 per year, unless eligible for a waiver |

Official references are collected in [Section 18](#18-official-references).

## 2. Where the code is on this computer

The repository root is:

```text
C:\Users\lenovo\Documents\ChatGPT\expense management
```

Important locations:

| Purpose | Local path |
|---|---|
| Mobile application | `C:\Users\lenovo\Documents\ChatGPT\expense management\apps\mobile` |
| Screens and navigation | `C:\Users\lenovo\Documents\ChatGPT\expense management\apps\mobile\src\app` |
| Reusable UI components | `C:\Users\lenovo\Documents\ChatGPT\expense management\apps\mobile\src\components` |
| Supabase client/API calls | `C:\Users\lenovo\Documents\ChatGPT\expense management\apps\mobile\src\infrastructure` |
| App identity, icons and native configuration | `C:\Users\lenovo\Documents\ChatGPT\expense management\apps\mobile\app.json` |
| EAS build profiles | `C:\Users\lenovo\Documents\ChatGPT\expense management\apps\mobile\eas.json` |
| Local mobile environment file | `C:\Users\lenovo\Documents\ChatGPT\expense management\apps\mobile\.env` |
| Environment template | `C:\Users\lenovo\Documents\ChatGPT\expense management\.env.example` |
| Database migrations | `C:\Users\lenovo\Documents\ChatGPT\expense management\supabase\migrations` |
| Database tests | `C:\Users\lenovo\Documents\ChatGPT\expense management\supabase\tests\database` |
| Email template | `C:\Users\lenovo\Documents\ChatGPT\expense management\supabase\templates\magic_link.html` |
| Shared request/database contracts | `C:\Users\lenovo\Documents\ChatGPT\expense management\packages\contracts` |
| Money/reporting domain helpers | `C:\Users\lenovo\Documents\ChatGPT\expense management\packages\domain` |

Current repository facts:

- Git branch: `codex/three-day-mobile-mvp`.
- No Git remote is currently configured.
- Android package: `com.familyledger.app`.
- iOS bundle identifier: `com.familyledger.app`.
- The EAS `preview` profile already uses internal distribution and will produce an installable APK.
- The application is not yet linked to an Expo/EAS project; `eas init` will add the project ID.
- There are nine ordered database migrations, ending with `0009_demo_family.sql`.

## 3. Accounts needed

Create these free accounts before starting:

1. An Expo account at <https://expo.dev/signup>.
2. A Supabase account at <https://supabase.com/dashboard>.
3. For email login by arbitrary family members, an SMTP provider account:
   - Brevo Free currently includes transactional email and up to 300 sends per day; or
   - Resend Free currently includes 3,000 emails per month and 100 per day.
4. Optional but strongly recommended: a GitHub account for an off-computer source backup.

Do not create a Google Play Console or Apple Developer account for the free APK route.

## 4. Protect the source before deployment

Open PowerShell and run:

```powershell
Set-Location -LiteralPath 'C:\Users\lenovo\Documents\ChatGPT\expense management'
git status
git branch --show-current
```

Review all changes before committing. When satisfied:

```powershell
git add --all
git commit -m "Prepare FamilyLedger Android pilot deployment"
```

The repository currently has no remote. To back it up to a new private GitHub repository, create an empty private repository in GitHub and then run:

```powershell
git remote add origin https://github.com/YOUR_GITHUB_NAME/family-ledger.git
git push -u origin codex/three-day-mobile-mvp
```

Replace `YOUR_GITHUB_NAME` and the repository name. Never commit `.env`, database passwords, SMTP credentials, service-role keys, Android keystores, or store credentials.

Confirm that the environment file is ignored:

```powershell
git check-ignore -v 'apps/mobile/.env'
```

It should print an ignore rule. If it prints nothing, stop and fix `.gitignore` before pushing.

## 5. Run the local release gate

Start Docker Desktop and let its Linux engine finish starting. Then run:

```powershell
Set-Location -LiteralPath 'C:\Users\lenovo\Documents\ChatGPT\expense management'
$familyLedgerCorepack = 'C:\Program Files\nodejs\corepack.cmd'
& $familyLedgerCorepack pnpm --version
& $familyLedgerCorepack pnpm install --frozen-lockfile
& '.\node_modules\.bin\supabase.CMD' start
```

This computer has Node.js and Corepack installed, but the standalone `pnpm` command may not be on the PowerShell `PATH`. Calling Corepack by its full path avoids a global installation or Windows `PATH` change. The Supabase executable is then called directly so pnpm does not try to launch a second, unavailable `pnpm` process.

If Corepack cannot download pnpm, use this one-command fallback instead:

```powershell
npx --yes pnpm@11.19.0 install --frozen-lockfile
& '.\node_modules\.bin\supabase.CMD' start
```

The required pnpm version is declared in the repository's root `package.json`.

Run the JavaScript/TypeScript checks:

```powershell
node --experimental-strip-types --test scripts/domain.test.mjs
& '.\apps\mobile\node_modules\.bin\tsc.CMD' --noEmit -p '.\apps\mobile\tsconfig.json'
Set-Location -LiteralPath '.\apps\mobile'
& '.\node_modules\.bin\eslint.CMD' '.\src' --max-warnings 0
Set-Location -LiteralPath '..\..'
```

Run the database checks:

```powershell
& '.\node_modules\.bin\supabase.CMD' test db
node scripts/verify-migrations.mjs
```

Expected result:

- 7 domain tests pass.
- TypeScript exits without an error.
- ESLint exits without warnings.
- 115 database assertions pass across 6 database test files.
- All 9 migrations replay successfully on an empty disposable schema.

Do not deploy while any of these checks fail.

## 6. Create the hosted Supabase project

1. Open <https://supabase.com/dashboard>.
2. Select **New project**.
3. Use a recognizable name such as `family-ledger-production`.
4. Select the region closest to the family using the app.
5. Generate a strong database password and save it in a password manager.
6. Stay on the Free plan.
7. Wait until project provisioning finishes.
8. Copy the project reference from the dashboard URL or Project Settings.

The project reference looks similar to `abcdefghijklmnopqrst`.

### Link the local migration directory

From the repository root:

```powershell
Set-Location -LiteralPath 'C:\Users\lenovo\Documents\ChatGPT\expense management'
& '.\node_modules\.bin\supabase.CMD' login
& '.\node_modules\.bin\supabase.CMD' link --project-ref YOUR_PROJECT_REF
```

Enter the hosted database password when prompted.

Confirm the linked target before changing anything:

```powershell
& '.\node_modules\.bin\supabase.CMD' projects list
& '.\node_modules\.bin\supabase.CMD' migration list
```

### Preview and deploy the database

First perform a dry run:

```powershell
& '.\node_modules\.bin\supabase.CMD' db push --linked --dry-run
```

It should list migrations `0001` through `0009`. Then deploy them:

```powershell
& '.\node_modules\.bin\supabase.CMD' db push --linked
& '.\node_modules\.bin\supabase.CMD' migration list
```

Open the Supabase SQL editor and confirm that these application tables exist in the `public` schema:

- `families`
- `family_members`
- `accounts`
- `categories`
- `transactions`
- `invitations`
- `join_requests`
- `notifications`
- `import_batches`
- `account_reconciliations`
- `audit_events`

Do not run `supabase db reset --linked`. It drops remote application data and is only appropriate for throwaway projects.

## 7. Configure Supabase authentication

The app currently supports email one-time-code/magic-link authentication. Google and Apple OAuth code exists but is disabled by default.

### URL configuration

In Supabase Dashboard, open **Authentication → URL Configuration**.

For the APK pilot, set:

```text
Site URL:
familyledger:///auth-callback

Redirect URLs:
familyledger:///auth-callback
familyledger://**
```

The exact callback used by the application is generated from the `familyledger` scheme configured in `apps/mobile/app.json`.

### Email provider

Open **Authentication → Sign In / Providers → Email** and confirm:

- Email provider is enabled.
- Email signups are enabled.
- Secure email change is enabled.
- For the initial pilot, email confirmation behavior matches the OTP/magic-link flow.

### Email template

Open **Authentication → Email Templates → Magic Link**.

Use the subject:

```text
Your FamilyLedger sign-in code
```

Copy the body from:

```text
C:\Users\lenovo\Documents\ChatGPT\expense management\supabase\templates\magic_link.html
```

The template contains both `{{ .Token }}` and `{{ .ConfirmationURL }}` so users can enter the code or open the link.

### Configure SMTP for actual family members

Supabase's default email sender is for demonstration only. It currently sends only to pre-authorized project-team addresses and has a very low rate limit. Use custom SMTP before inviting normal family members.

One free option is Brevo:

1. Create a Brevo Free account.
2. Create and verify a transactional sender.
3. Open Brevo's SMTP page and generate an SMTP key.
4. In Supabase, open **Project Settings → Authentication → SMTP Settings**.
5. Enable custom SMTP.
6. Enter:

```text
Host: smtp-relay.brevo.com
Port: 587
Username: the SMTP login shown by Brevo
Password: the generated SMTP key
Sender email: the verified sender
Sender name: FamilyLedger
```

Store the SMTP key only in Supabase/Brevo. Never place it in `apps/mobile/.env` or an `EXPO_PUBLIC_` variable.

Send a test login email and check inbox, spam folder, and Supabase Auth logs before building the APK.

## 8. Collect the public Supabase app values

In Supabase Dashboard, open **Project Settings → API** and copy:

1. Project URL, for example `https://YOUR_PROJECT_REF.supabase.co`.
2. The publishable key.

The URL and publishable key are designed for client applications and are protected by Row Level Security. Never use any secret key or `service_role` key in this mobile app.

Create or update the local file:

```text
C:\Users\lenovo\Documents\ChatGPT\expense management\apps\mobile\.env
```

Use this structure:

```dotenv
EXPO_PUBLIC_APP_ENV=preview
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
EXPO_PUBLIC_INVITE_ORIGIN=familyledger://
EXPO_PUBLIC_ENABLE_SOCIAL_AUTH=false
```

For the free APK pilot, `familyledger://` makes invitation sharing produce a native link such as:

```text
familyledger:///invite/INVITATION_TOKEN
```

If a messaging application does not make custom-scheme links clickable, the recipient can copy the complete link and paste it into **More → Accept invitation**. Do not leave the placeholder `https://invite.example.com` in a real build.

## 9. Choose the permanent app identity

Before the first Play Store release, choose a package name you control. The current identifier is:

```text
com.familyledger.app
```

For a private APK pilot, it can remain unchanged. For a public release, change both identifiers in `apps/mobile/app.json`, for example:

```json
"ios": {
  "bundleIdentifier": "com.yourname.familyledger"
},
"android": {
  "package": "com.yourname.familyledger"
}
```

Use a lowercase reverse-domain identifier. Once an application is created in Google Play, changing the package name creates a different app rather than an update.

Also review in `apps/mobile/app.json`:

- `name`: `FamilyLedger`
- `version`: currently `0.1.0`
- app icon and adaptive Android icons
- splash-screen image and color
- scheme: `familyledger`

Do not change the `familyledger` scheme without also changing Supabase redirect URLs and testing auth/invitation links again.

## 10. Link the app to Expo EAS

Expo's monorepo instructions require EAS commands to be run from the app directory, not the repository root.

```powershell
Set-Location -LiteralPath 'C:\Users\lenovo\Documents\ChatGPT\expense management\apps\mobile'
npx eas-cli@latest login
npx eas-cli@latest whoami
npx eas-cli@latest init
```

When prompted:

1. Select your Expo account.
2. Create a new EAS project named `family-ledger` or link an existing one.
3. Allow EAS to add `extra.eas.projectId` to the app configuration.

Commit the updated `app.json` after inspecting it. The project ID is not a secret.

## 11. Configure EAS preview environment variables

The local `.env` file is deliberately ignored and is not the correct source for cloud builds. Add the five client-safe variables to the EAS `preview` environment.

Run from `apps/mobile`:

```powershell
npx eas-cli@latest env:set --environment preview --name EXPO_PUBLIC_APP_ENV --value preview --visibility plaintext
npx eas-cli@latest env:set --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value https://YOUR_PROJECT_REF.supabase.co --visibility plaintext
npx eas-cli@latest env:set --environment preview --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value YOUR_PUBLISHABLE_KEY --visibility plaintext
npx eas-cli@latest env:set --environment preview --name EXPO_PUBLIC_INVITE_ORIGIN --value 'familyledger://' --visibility plaintext
npx eas-cli@latest env:set --environment preview --name EXPO_PUBLIC_ENABLE_SOCIAL_AUTH --value false --visibility plaintext
```

Verify them:

```powershell
npx eas-cli@latest env:list --environment preview
```

These are public mobile values. SMTP passwords, Supabase secret/service-role keys, database passwords, and OAuth client secrets must not be added with the `EXPO_PUBLIC_` prefix.

## 12. Build the signed Android APK for free

The existing `apps/mobile/eas.json` contains:

```json
"preview": {
  "distribution": "internal",
  "environment": "preview",
  "channel": "preview"
}
```

Internal Android distribution produces an installable APK. Start the build:

```powershell
Set-Location -LiteralPath 'C:\Users\lenovo\Documents\ChatGPT\expense management\apps\mobile'
npx eas-cli@latest build --platform android --profile preview
```

For the first build:

1. Choose EAS-managed Android credentials.
2. Allow EAS to generate the Android keystore.
3. Save the Expo account recovery information securely.
4. Wait for the free low-priority build queue.

EAS will print a build-details URL. When the build finishes, open it and download the APK.

Keep the generated keystore association. Future versions must be signed with the same key to update an installed app.

## 13. Install and test the APK

### Install on the Android emulator

EAS can download and install the latest build:

```powershell
npx eas-cli@latest build:run --platform android --latest
```

### Install a downloaded APK with ADB

If the APK was saved as `FamilyLedger-preview.apk`:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r 'C:\Path\To\FamilyLedger-preview.apk'
```

### Install on a physical Android phone

1. Open the EAS build URL on the phone.
2. Download the APK.
3. Android may ask permission to install unknown apps from the browser or Files app.
4. Enable that permission only for the installer being used.
5. Install FamilyLedger.
6. Disable the permission again after installation if desired.

For additional integrity checking, download the APK on Windows and record its SHA-256 hash:

```powershell
Get-FileHash -Algorithm SHA256 'C:\Path\To\FamilyLedger-preview.apk' | Format-List
```

Share the expected hash separately from the APK link.

## 14. End-to-end acceptance test

Use two different email accounts and preferably two Android devices.

### Owner device

1. Launch FamilyLedger.
2. Request an email sign-in code.
3. Confirm the email arrives through the configured SMTP provider.
4. Enter the code or open the magic link on the same device.
5. Create a real family, or use **Create sample family** for a quick verification.
6. Create an account, income, and expense.
7. Confirm Home, Activity, Insights, and Accounts totals agree.
8. Create an invitation from **More → Invitation links**.

### Joining device

1. Install the same APK.
2. Open or paste the invitation link.
3. Sign in with the second email account.
4. Request access.
5. Confirm no family financial data is visible while approval is pending.

### Owner approval

1. Open **More → Join requests**.
2. Approve the pending person.
3. Confirm the new member can now access the family.
4. Add a transaction on one device.
5. Confirm it appears on the other device through realtime refresh.
6. Verify Viewer/Member/Admin permissions as appropriate.

### Additional release checks

- Transfer money between two accounts and verify household net is unchanged.
- Export a transaction/report CSV and open the shared file.
- Import a test CSV, confirm duplicate detection, and roll back the batch.
- Edit family notes and confirm the second device receives the update.
- Suspend and restore a non-owner member.
- Test a deleted transaction and restore it from Trash.
- Sign out and confirm protected data disappears.
- Test after force-closing and reopening the app.
- Test with airplane mode and a restored internet connection.

Do not distribute more widely until this full sequence passes against the hosted Supabase project.

## 15. Share the free pilot

The EAS internal-distribution build page provides an installation URL. Send testers:

1. The official EAS installation URL.
2. The expected APK SHA-256 hash.
3. A short explanation that this is a private pilot installed outside Google Play.
4. The support/contact email.
5. Instructions for reporting device model, Android version, screen, and exact error.

Internal build URLs may be accessible to anyone who has the URL. In the Expo project settings, disable unauthenticated internal-build access if every tester can use an Expo account. Otherwise, treat the URL as private and revoke/replace it if it is exposed.

Do not upload the APK to random file-sharing sites. Keep it on the EAS build page or a release location you control.

## 16. Deploy future updates safely

### Application-code update

1. Make the code changes.
2. Run all checks in [Section 5](#5-run-the-local-release-gate).
3. Increase `expo.version` in `apps/mobile/app.json` when appropriate.
4. Commit the change.
5. Run another preview build:

```powershell
Set-Location -LiteralPath 'C:\Users\lenovo\Documents\ChatGPT\expense management\apps\mobile'
npx eas-cli@latest build --platform android --profile preview
```

6. Install the new APK over the old one. It will update in place only when the Android package and signing key are unchanged.

The project does not currently include a fully configured over-the-air update workflow, so use a new APK for application-code changes.

### Database update

Create a new numbered migration. Never rewrite a migration already applied to production.

Before pushing a database migration, create logical backups outside the repository. Example destination:

```text
C:\Users\lenovo\Documents\FamilyLedger-Backups\2026-09-24
```

Then run from the repository root:

```powershell
& '.\node_modules\.bin\supabase.CMD' db dump --linked --file 'C:\Users\lenovo\Documents\FamilyLedger-Backups\2026-09-24\schema.sql'
& '.\node_modules\.bin\supabase.CMD' db dump --linked --data-only --use-copy --file 'C:\Users\lenovo\Documents\FamilyLedger-Backups\2026-09-24\data.sql'
& '.\node_modules\.bin\supabase.CMD' db push --linked --dry-run
& '.\node_modules\.bin\supabase.CMD' db push --linked
```

Supabase recommends regular CLI exports for Free projects because managed daily backups are not included.

## 17. Optional public-store deployment

### Google Play

This is not part of the free route.

1. Pay the one-time USD 25 Google Play developer registration fee.
2. Finalize the permanent Android package ID before creating the Play app.
3. Prepare a privacy policy, support email, store icon, screenshots, feature graphic, content rating, data-safety form, and account-deletion policy/workflow.
4. Create a production AAB:

```powershell
Set-Location -LiteralPath 'C:\Users\lenovo\Documents\ChatGPT\expense management\apps\mobile'
npx eas-cli@latest build --platform android --profile production
```

5. Complete the first upload manually in Google Play Console or configure EAS Submit.
6. New personal Play accounts may need at least 12 opted-in closed testers for 14 continuous days before applying for production access.

Do not submit the current application to a public store until the manual accessibility audit, privacy policy, support contact, account-deletion design, and store disclosures are complete.

### iOS

Normal TestFlight/App Store distribution requires Apple Developer Program membership, currently USD 99 per year unless eligible for a waiver. It also requires iOS runtime testing and Apple signing/provisioning. The free Android APK route does not deploy iOS.

## 18. Official references

- Expo EAS pricing: <https://expo.dev/pricing>
- Expo EAS plans: <https://docs.expo.dev/billing/plans/>
- Expo Android APK builds: <https://docs.expo.dev/build-reference/apk/>
- Expo internal distribution: <https://docs.expo.dev/build/internal-distribution/>
- Expo monorepo builds: <https://docs.expo.dev/build-reference/build-with-monorepos/>
- Expo environment variables: <https://docs.expo.dev/eas/environment-variables/manage/>
- Expo Android submission: <https://docs.expo.dev/submit/android/>
- Supabase pricing: <https://supabase.com/pricing>
- Supabase migration deployment: <https://supabase.com/docs/guides/deployment/database-migrations>
- Supabase redirect URLs: <https://supabase.com/docs/guides/auth/redirect-urls>
- Supabase SMTP restrictions/setup: <https://supabase.com/docs/guides/auth/auth-smtp>
- Supabase backups: <https://supabase.com/docs/guides/platform/backups>
- Brevo Free plan: <https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans>
- Brevo SMTP setup: <https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP>
- Resend pricing: <https://resend.com/pricing>
- Google Play registration requirements: <https://support.google.com/googleplay/android-developer/answer/14659200>
- Google Play personal-account testing: <https://support.google.com/googleplay/android-developer/answer/14151465>
- Apple membership comparison: <https://developer.apple.com/support/compare-memberships/>

## 19. Final deployment checklist

### Source and quality

- [ ] Source changes reviewed and committed
- [ ] Private off-computer source backup created
- [x] `.env` confirmed ignored
- [x] TypeScript passed
- [x] ESLint passed with zero warnings
- [x] Domain tests passed
- [x] 115 database assertions passed
- [x] All 9 migrations replayed cleanly

### Hosted backend

- [x] Supabase Free project created in the correct region
- [x] Database password stored safely
- [x] Local project linked to the correct project reference
- [x] Migration dry run reviewed
- [x] Migrations `0001`–`0009` pushed
- [ ] RLS-enabled tables verified
- [x] Auth site URL and redirect URLs configured
- [x] Magic-link/OTP email template configured
- [x] Custom SMTP configured
- [ ] Custom SMTP tested with a non-team email address
- [ ] Project URL and publishable key collected
- [ ] No secret/service-role key placed in mobile configuration

### Expo/EAS

- [ ] Permanent package ID decision made
- [ ] Expo account created
- [ ] EAS project initialized from `apps/mobile`
- [ ] `extra.eas.projectId` added and committed
- [ ] Five preview environment variables configured
- [ ] EAS preview build completed
- [ ] EAS-managed Android keystore retained
- [ ] APK downloaded and SHA-256 recorded

### Runtime acceptance

- [ ] APK installed on a physical Android device
- [ ] Email code/link login works
- [ ] Owner family creation works
- [ ] Sample-family creation works
- [ ] Invitation and pending approval work on a second account
- [ ] Owner approval grants access
- [ ] Realtime transaction synchronization works
- [ ] Reports match transaction/account totals
- [ ] CSV import, duplicate detection, rollback, and export work
- [ ] Role restrictions and member suspension work
- [ ] Sign-out removes protected data
- [ ] Pilot installation link shared only with intended testers

When every applicable checkbox is complete, the free Android pilot is deployed.
