# CAN Protection — Test & Verification Report

**Test Date**: 2026-11-24  
**Runtime**: Node.js `v22.23.5` + Express 4 + Vite 8 + React 19

## 1. Executed Automated Tests (`npm test`)

Command: `tsx --test src/lib/phone.test.ts src/lib/otp-policy.test.ts server/env.test.ts server/db.test.ts server/routes.test.ts`

| Test File | Coverage | Result |
| --- | --- | --- |
| `src/lib/phone.test.ts` | Country-aware E.164 normalization, leading-zero/`+91` stripping, invalid prefix/letter rejection, `last4` extraction, `maskPhoneParts` | **PASS** (5/5 tests) |
| `src/lib/otp-policy.test.ts` | Non-plaintext OTP HMAC + `timingSafeEqual`, keyed E.164 `hashPhoneLookup`, replay/expiry/brute-force rules, sliding-window rate limiting, registration transitions | **PASS** (5/5 tests) |
| `server/env.test.ts` | Optional Twilio/MSG91 vars when `OTP_PROVIDER=demo`, fail-closed checks for `twilio`/`msg91`/unknown providers, `NODE_ENV=production` / `VERCEL=1` demo block unless `ALLOW_DEV_OTP_DEMO=true`, `SUPABASE_SECRET_KEY` + `PHONE_LOOKUP_HMAC_KEY` validation, local SQLite fallback | **PASS** (9/9 tests) |
| `server/db.test.ts` | Mocked `@supabase/supabase-js` `public.phone_registrations` 10-column schema lock, explicit `updated_at` on insert/activate/re-verify/deactivate, `23505` insert-race recovery, `verifySchema()` error propagation, SQLite legacy raw-phone table cleanup | **PASS** (4/4 tests) |
| `server/routes.test.ts` | Full HTTP lifecycle (`401` unauth, `400` bad phone, `201` anti-enumeration OTP request, `429` cooldown, `400` wrong code, `200` verify, `409` replay, `410` expired OTP, `429` brute-force lockout, `404` unknown challenge & `/api/*`, `200` status/activate/re-activate/confirm-deactivate/logout, zero raw phone rows in SQLite, `503` missing `PHONE_LOOKUP_HMAC_KEY`, `503` production demo block) | **PASS** (3/3 integration tests) |

**Total Automated Tests**: **26/26 passing** (`0` failing, `0` skipped).

## 2. Build, Type-Check & Security Scans

- `npm run build` (`vite build`): **PASS** (clean production bundle into `dist/`).
- `npm run lint` (`tsc --noEmit`): **PASS** (zero TypeScript errors).
- Frontend secret & cleanup scan (`src/`, `index.html`, `vite.config.ts`): Confirmed zero references to `SUPABASE_*`, `PHONE_LOOKUP_HMAC_KEY`, `service_role`, `@google/genai`, or `aistudio`.
- Production server startup (`NODE_ENV=production node server.ts`):
  - Verified with `ALLOW_DEV_OTP_DEMO=true` on port `3199`: served SPA HTML (`200`) and `/api/health` (`200`, `ok: true`, `storageBackend: "local_sqlite_dev"`).
  - Verified without `ALLOW_DEV_OTP_DEMO` on port `3198`: `/api/health` returned `otpConfigured: false`, `ok: false`, confirming fail-closed production OTP behavior.

## 3. Browser UI & Console Verification (Headless Chromium)

Inspected `http://localhost:3000` via Playwright CLI (`playwright-cli`):
- **Desktop (`1440x900`, Dark & Light modes)**: Verified hero form, country selector (`+91`), official CAN Protection logo/emblem, blue/slate `Not Registered` status card, updated Privacy Policy dialog copy, explicit telecom-blocking limitation in `AboutSection`, and zero console errors/warnings.
- **Mobile (`390x844`)**: Verified responsive stacking with zero horizontal overflow (`innerWidth === 390`, `scrollWidth === 390`) and zero console errors/warnings.

## 4. Remote Supabase & Live SMS Status

- **Earlier In-Memory Remote Supabase Test (`edykghafxrrvsfbcxnkt`)**: In an earlier session turn, with user-supplied `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and an ephemeral 32-byte `PHONE_LOOKUP_HMAC_KEY` passed in memory only, `GET /api/health` returned `200 OK` (`ok: true`, `storageBackend: "supabase_postgres"`, `schemaVerified: true`), and end-to-end OTP request -> verify -> status (`not_registered`) -> activate (`active`) -> confirmed deactivate (`inactive`) -> logout passed with zero raw phone digits stored before deleting the test row.
- **Current Container Runtime State**: Because no `.env` file or server Secrets are persisted in this container, the current local server defaults to `storageBackend: "local_sqlite_dev"` and `OTP_PROVIDER=demo` until `.env` (or hosting Secrets) is configured.
- **Live SMS Delivery (`twilio` / `msg91`)**: Implemented and env-validated, **not remotely verified** (blocked by missing vendor credentials and India TRAI DLT registration).
