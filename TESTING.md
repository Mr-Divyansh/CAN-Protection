# CAN Protection — Test & Verification Report

**Hardening CI Verification**: 2026-11-24  
**Runtime**: Node.js `v22.23.5` + Express 4 + Vite 8 + React 19

## Verification status

GitHub Actions run [#45443413351](https://github.com/Mr-Divyansh/CAN-Protection/actions/runs/45443413351) passed for commit `c4d85f41d3a352d9b558385217c31c261ee15f20`: frozen dependency installation, TypeScript check, 29 automated tests, and production frontend build.

## 1. Automated Tests (`npm test`)

Command: `tsx --test src/lib/phone.test.ts src/lib/otp-policy.test.ts server/env.test.ts server/db.test.ts server/routes.test.ts`

| Test File | Coverage | Result |
| --- | --- | --- |
| `src/lib/phone.test.ts` | Country-aware E.164 normalization, leading-zero/`+91` stripping, invalid prefix/letter rejection, `last4` extraction, `maskPhoneParts` | **PASS** (5/5 tests) |
| `src/lib/otp-policy.test.ts` | Non-plaintext OTP HMAC + `timingSafeEqual`, keyed E.164 `hashPhoneLookup`, replay/expiry/brute-force rules, sliding-window rate limiting, registration transitions | **PASS** (5/5 tests) |
| `server/env.test.ts` | Optional Twilio/MSG91 vars when `OTP_PROVIDER=demo`, fail-closed checks for `twilio`/`msg91`/unknown providers, `NODE_ENV=production` / `VERCEL=1` demo block with no override, production Supabase requirement, persistent server secret and single-instance storage opt-in, `SUPABASE_SECRET_KEY` + `PHONE_LOOKUP_HMAC_KEY` validation, development-only SQLite fallback | **PASS** (10/10 tests) |
| `server/db.test.ts` | Mocked `@supabase/supabase-js` `public.phone_registrations` 10-column schema lock, explicit `updated_at` on insert/activate/re-verify/deactivate, `23505` insert-race recovery, `verifySchema()` error propagation, SQLite legacy raw-phone table cleanup | **PASS** (4/4 tests) |
| `server/routes.test.ts` | Full HTTP lifecycle (`401` unauth, `400` bad phone, `201` anti-enumeration OTP request, `429` cooldown, `400` wrong code, `200` verify, `409` replay, `410` expired OTP, `429` brute-force lockout, `404` unknown challenge & `/api/*`, `200` status/activate/re-activate/confirm-deactivate/logout, zero raw phone rows in SQLite, `503` missing `PHONE_LOOKUP_HMAC_KEY`, `503` production demo block) | **PASS** (5/5 integration tests, including concurrent OTP-attempt enforcement) |

**Total Automated Tests**: **29/29 passing** (`0` failing, `0` skipped).

## 2. Build, Type-Check & Security Scans

- `npm run build` (`vite build`): **PASS** (clean production bundle into `dist/`).
- `npm run lint` (`tsc --noEmit`): **PASS** (zero TypeScript errors).
- Frontend secret & cleanup scan (`src/`, `index.html`, `vite.config.ts`): Confirmed zero references to `SUPABASE_*`, `PHONE_LOOKUP_HMAC_KEY`, `service_role`, `@google/genai`, or `aistudio`.
- Production server startup (`NODE_ENV=production node server.ts`):
  - Production startup with real credentials was **not** executed in CI. Production configuration is deliberately strict: Supabase, real OTP provider, persistent 32+ character server secret, and explicit persistent SQLite path on a single-instance Node host are required. Vercel/serverless is rejected.

## 3. Browser UI & Console Verification (Headless Chromium)

Inspected `http://localhost:3000` via Playwright CLI (`playwright-cli`):
- **Desktop (`1440x900`, Dark & Light modes)**: Verified hero form, country selector (`+91`), official CAN Protection logo/emblem, blue/slate `Not Registered` status card, updated Privacy Policy dialog copy, explicit telecom-blocking limitation in `AboutSection`, and zero console errors/warnings.
- **Mobile (`390x844`)**: Verified responsive stacking with zero horizontal overflow (`innerWidth === 390`, `scrollWidth === 390`) and zero console errors/warnings.

## 4. Remote Supabase & Live SMS Status

- **Earlier In-Memory Remote Supabase Test (`edykghafxrrvsfbcxnkt`)**: In an earlier session turn, with user-supplied `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and an ephemeral 32-byte `PHONE_LOOKUP_HMAC_KEY` passed in memory only, `GET /api/health` returned `200 OK` (`ok: true`, `storageBackend: "supabase_postgres"`, `schemaVerified: true`), and end-to-end OTP request -> verify -> status (`not_registered`) -> activate (`active`) -> confirmed deactivate (`inactive`) -> logout passed with zero raw phone digits stored before deleting the test row.
- **Current Runtime Verification**: No local server was started during the GitHub-only hardening task. The CI workflow verifies dependency installation, type-checking, tests, and frontend build; it does not prove production credentials or live SMS delivery.
- **Live SMS Delivery (`twilio` / `msg91`)**: Implemented and env-validated, **not remotely verified** (blocked by missing vendor credentials and India TRAI DLT registration).
