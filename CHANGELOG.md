# Changelog

## [0.3.0] — 2026-11-24 (Final Handover Audit)
### Changed & Fixed
- Enforced fail-closed production OTP guard in `server/env.ts` and `server/otp-provider.ts`: `NODE_ENV=production` or `VERCEL=1` rejects `demo` / unset `OTP_PROVIDER` (`503`) unless `ALLOW_DEV_OTP_DEMO=true` is explicitly configured.
- Hardened `consumeOtpChallenge` in `server/db.ts` and `/api/otp/verify` in `server/routes.ts` to check atomic SQLite update counts (`409` on concurrent replay race), included `supabaseSecretKey` SHA-256 digest in Supabase client cache signatures, added an `/api/*` JSON `404` catch-all handler, and surfaced `schemaVerified` in `GET /api/health`.
- Updated `package.json` to remove unused `@google/genai`, declare `"engines": { "node": ">=22.18.0" }`, and replace POSIX shell test globs with explicit file paths for Windows compatibility; replaced `import.meta.filename` in `server.ts` with `fileURLToPath(import.meta.url)`.
- Updated `src/components/ProtectionPortal.tsx` to align `Not Registered` status badge styling with the approved blue/slate brand palette, and updated `src/components/LegalModal.tsx` and `PRIVACY-POLICY.md` to match HMAC hash + `phone_last4` storage accurately.
- Removed unused AI Studio attachment files (`public/assets/aistudio/`).
- Expanded test suite to 26 passing tests (`server/env.test.ts`, `server/db.test.ts`, `server/routes.test.ts`).
- Created/updated comprehensive handover documentation (`PROJECT-HANDOVER.md` with ChatGPT next-development prompt, `KNOWN-ISSUES.md`, `PROJECT-FILE-INDEX.md`, `README.md`, `API.md`, `ARCHITECTURE.md`, `SECURITY.md`, `DATABASE.md`, `DEPLOYMENT.md`, `OTP-PROVIDER-SETUP.md`, `TESTING.md`, `SECURITY-AUDIT-REPORT.md`, `MEMO.md`).

## [0.2.0] — 2026-11-24
### Changed & Added
- Integrated existing private Supabase table `public.phone_registrations` (`edykghafxrrvsfbcxnkt`) via `@supabase/supabase-js` (`server/db.ts`) using `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and `PHONE_LOOKUP_HMAC_KEY`.
- Removed raw/normalized E.164 phone number persistence across all database tables (`phone_registrations`, `otp_challenges`, `verified_sessions`, `rate_limit_events`), storing only HMAC-SHA256 digests (`hashPhoneLookup`), `phone_last4`, and `country_code`.
- Added explicit `updated_at` timestamp updates on every `phone_registrations` insert, activation, re-verification, and deactivation.
- Added `server/db.test.ts` and expanded `server/env.test.ts`, `src/lib/phone.test.ts`, `src/lib/otp-policy.test.ts`, and `server/routes.test.ts`.
- Made Twilio and MSG91 environment variables optional when `OTP_PROVIDER=demo` while preserving strict validation when `twilio` or `msg91` is selected.

## [0.1.0] — 2026-11-24
### Added
- Extracted official CAN Protection logo symbol, app icon, and favicon assets from supplied brand sheet (`public/assets/`).
- Built responsive Desktop & Mobile frontend with persistent Dark Mode (`#0C0F13`) and Light Mode (`#F4F1EA` / `#FFFFFF`) themes.
- Implemented country-aware phone number validation and E.164 normalization (`src/lib/phone.ts`).
- Implemented OTP cryptographic hashing, expiry, attempt limits, replay prevention, rate limiting, and registration transition state machine (`src/lib/otp-policy.ts`).
- Built Express API (`server.ts`, `server/routes.ts`, `server/session.ts`, `server/otp-provider.ts`, `server/db.ts`) with draft legal/provider documentation.
