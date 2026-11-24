# CAN Protection — Project Handover Guide

## 1. What CAN Protection Does
**CAN Protection** (*Protect Yourself. Stay Connected.*) is a responsive cybersecurity web application for **mobile-number ownership verification** and **CAN Protection registration status management**.

Intended user flow:
1. User selects a country code (`+91` default) and enters a mobile number.
2. Server validates and normalizes the number to E.164 and creates a single-use, rate-limited OTP challenge (`POST /api/otp/request`).
3. User submits the 6-digit code (`POST /api/otp/verify`) to verify number ownership and receives a short-lived in-memory Bearer token.
4. Verified user views current registration status (`not_registered`, `active`, or `inactive` via `GET /api/registration/status`).
5. Verified user can activate protection (`POST /api/registration/activate`) or deactivate after explicit confirmation (`POST /api/registration/deactivate` with `{ "confirm": true }`).

### Important Product Limitation
**A website and database registration do not automatically block incoming calls or prevent call bombing at the telecom-network level.** CAN Protection provides verified ownership registration, status management, and defensive call-safety guidance. Actual network-level call blocking requires carrier, telecom-regulator (e.g., TRAI DND / Sanchar Saathi), or OS-level integration. Never present website registration as telecom call blocking.

---

## 2. Current Architecture
- **Frontend**: React 19 + TypeScript + Vite 8 + Tailwind CSS v4 (`src/App.tsx`, `src/components/*`).
  - Session tokens are held **only in React memory** (never in `localStorage` or `sessionStorage`).
  - Browser code never connects directly to Supabase and never reads server secrets.
- **Backend**: Express 4 server (`server.ts`, `server/routes.ts`, `server/session.ts`, `server/otp-provider.ts`, `server/env.ts`, `server/db.ts`).
  - In development, `server.ts` mounts Vite middleware on port `3000`.
  - In production (`NODE_ENV=production`), `server.ts` serves `/api/*` and static files from `dist/`.
- **Persistence Split (`server/db.ts`)**:
  - **Registrations (`public.phone_registrations`)**: Production requires the private Supabase table via server-only `SUPABASE_URL` + `SUPABASE_SECRET_KEY`. Local `node:sqlite` registration storage is development-only.
  - **Transient Security State (`otp_challenges`, `verified_sessions`, `rate_limit_events`)**: Stored in local `node:sqlite`. Production is restricted to a single-instance persistent Node host with `CAN_ALLOW_PRODUCTION_SQLITE=true` and an absolute `CAN_SQLITE_PATH`; Vercel/serverless and multi-instance hosting are blocked until a shared store is implemented. No raw or normalized E.164 phone numbers are stored in any table.

---

## 3. Important Folders & Files
- `server.ts` — Express + Vite server entry point.
- `server/` — Backend API router, DB adapters, env validation, OTP providers, session auth, and server/DB tests.
- `src/` — React UI, types, and pure shared validation/policy logic (`src/lib/phone.ts`, `src/lib/otp-policy.ts`).
- `public/assets/` — Approved CAN Protection logo, dark/light assets, app icon, and favicon.
- `supabase/legacy/001_init_can_protection.sql` — Archived unsafe legacy schema; never execute. `supabase/migrations/` tracks the two migrations already applied to the connected project.
- See `PROJECT-FILE-INDEX.md` for a full file-by-file directory map.

---

## 4. Installing & Running Locally (Windows PC / macOS / Linux)
- **Required Runtime**: Node.js `>= 22.18.0` (needed for built-in `node:sqlite` and native TypeScript type-stripping on `node server.ts`).
- **Install dependencies**:
  ```bash
  npm install
  ```
- **Environment setup**:
  1. Copy `.env.example` to `.env` (`.env` is gitignored via `.env*`).
  2. For local development with SQLite and simulated OTP:
     - Set `OTP_PROVIDER=demo`
     - Leave `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and `PHONE_LOOKUP_HMAC_KEY` blank for local SQLite, OR set all three to test against Supabase.
- **Run development server** (http://localhost:3000):
  ```bash
  npm run dev
  ```
- **Build & run production bundle locally**:
  ```bash
  npm run build
  set NODE_ENV=production   # Windows cmd (or $env:NODE_ENV="production" in PowerShell)
  npm run start
  ```
  *(Production requires Supabase, real OTP provider credentials, a persistent `CAN_SERVER_SECRET` (32+ characters), and the explicit persistent SQLite settings above. Demo OTP is never allowed in production.)*

---

## 5. Environment Variables
| Variable | Scope | Required When | Purpose |
| --- | --- | --- | --- |
| `SUPABASE_URL` | Server only | Using Supabase | Project URL (`https://edykghafxrrvsfbcxnkt.supabase.co`) |
| `SUPABASE_SECRET_KEY` | Server only | Using Supabase | Privileged server key (`sb_secret_...` or legacy `SUPABASE_SERVICE_ROLE_KEY`) |
| `PHONE_LOOKUP_HMAC_KEY` | Server only | Using Supabase | Secret >= 16 chars (32+ bytes recommended) for `HMAC-SHA256` E.164 phone lookup |
| `OTP_PROVIDER` | Server only | Production (always); Dev (`demo` default) | `demo`, `twilio`, or `msg91` |
| `CAN_ALLOW_PRODUCTION_SQLITE` / `CAN_SQLITE_PATH` | Server only | Single-instance production Node host only | Explicitly enables persistent local SQLite for transient state; never use on Vercel/serverless |
| `TWILIO_ACCOUNT_SID` / `AUTH_TOKEN` / `FROM_NUMBER` | Server only | `OTP_PROVIDER=twilio` | Twilio Programmable SMS delivery |
| `MSG91_AUTH_KEY` / `MSG91_TEMPLATE_ID` | Server only | `OTP_PROVIDER=msg91` | MSG91 OTP SMS delivery |
| `CAN_SERVER_SECRET` | Server only | Required in production | Persistent random secret, at least 32 characters, for OTP/session/IP HMACs |
| `PORT` / `APP_URL` / `TRUST_PROXY_HOPS` | Server only | Optional | HTTP port (`3000`), hosting URL, or verified reverse-proxy hop count (default `0`) |

**Never** prefix any of these secrets with `VITE_` or commit `.env` files to Git.

---

## 6. Supabase Configuration & Schema
- **Project**: `CAN-Protection` (`edykghafxrrvsfbcxnkt`, `https://edykghafxrrvsfbcxnkt.supabase.co`)
- **Table**: `public.phone_registrations` (already created remotely; do **not** create duplicate tables)
- **Columns (exact 10-column schema)**:
  `id`, `phone_number_hash`, `phone_last4`, `country_code`, `status`, `verified_at`, `activated_at`, `deactivated_at`, `created_at`, `updated_at`
- **RLS Policy**: RLS is intentionally enabled with **zero** public/anon/authenticated policies. All reads and writes must go through the Express server using `SUPABASE_SECRET_KEY`. Do not add permissive public RLS policies to silence dashboard warnings.
- **Explicit `updated_at`**: Application code explicitly writes `updated_at` on every insert, activation, re-verification, and deactivation.

---

## 7. API Routes
All routes live under `/api` with `Cache-Control: no-store, max-age=0`:
- `GET /api/health` — Returns `{ ok, otpConfigured, storageConfigured, schemaVerified, verificationMode, providerName, storageBackend }`.
- `POST /api/otp/request` — Validates phone, enforces rate limits & cooldown, sends/simulates OTP, returns `challengeId` and `maskedPhone` (anti-enumeration: never discloses registration state).
- `POST /api/otp/verify` — Verifies OTP hash (`timingSafeEqual`), atomically marks challenge consumed (`409` on replay, `410` on expiry, `429` on lockout), issues Bearer `sessionToken`.
- `GET /api/registration/status` — Bearer-authenticated lookup by `session.phone_hash`.
- `POST /api/registration/activate` — Bearer-authenticated duplicate-safe insert/update to `active`.
- `POST /api/registration/deactivate` — Bearer-authenticated deactivation (`{ confirm: true }` required) to `inactive`.
- `POST /api/session/logout` — Revokes active Bearer session.

---

## 8. Security Architecture
- **Phone Privacy**: Raw phone numbers are normalized in memory (`src/lib/phone.ts`), hashed via `HMAC-SHA256(PHONE_LOOKUP_HMAC_KEY, e164)`, and discarded; DB rows hold only `phone_number_hash`, `phone_last4`, and `country_code`. Rotating `PHONE_LOOKUP_HMAC_KEY` without migrating hashes orphans existing records because raw numbers cannot be recovered from hashes.
- **OTP & Session Security**: 5-minute OTP TTL, 5 max attempts, 30s resend cooldown, 15-minute session TTL, HMAC-SHA256 hashes for OTPs and Bearer tokens, sliding-window rate limits per IP and phone hash, and fail-closed `503` when production OTP or Supabase secrets are misconfigured.

---

## 9. How to Run Tests, Lint & Build
```bash
npm test      # Runs unit, DB adapter, env validation, and HTTP API tests (26 tests)
npm run lint  # Runs TypeScript compiler check (tsc --noEmit)
npm run build # Builds production SPA bundle into dist/
```

---

## 10. Current Status Summary
- **Completed & Verified Locally**: Full responsive UI (dark/light, desktop/mobile) with approved CAN Protection branding, full OTP/auth/registration lifecycle, zero raw phone storage, unconditional production demo-mode block and production storage guards, mocked Supabase 10-column adapter tests, `tsc --noEmit`, and `vite build`.
- **Verified In-Memory Against Remote Supabase**: Tested in-memory against `https://edykghafxrrvsfbcxnkt.supabase.co` (`GET /api/health` -> `ok: true`, `storageBackend: "supabase_postgres"`, `schemaVerified: true`, and live status/activate/deactivate round-trip).
- **Incomplete / Remaining**: Rotate exposed Supabase secret key, configure `.env` / hosting Secrets (`SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `PHONE_LOOKUP_HMAC_KEY`, `CAN_SERVER_SECRET`), configure live SMS (`OTP_PROVIDER=twilio` or `msg91` + India DLT), finalize legal/contact placeholders (`PRIVACY-POLICY.md`, `TERMS.md`, `CONTACT.md`, `LegalModal.tsx`), and decide multi-instance storage for transient OTP/session tables if deploying serverless/horizontally scaled. See `KNOWN-ISSUES.md`.

---

## 11. CHATGPT NEXT-DEVELOPMENT PROMPT

Copy and paste the prompt below when continuing work in ChatGPT with access to the downloaded local folder and GitHub repository:

```text
You are taking over development of the CAN Protection project on my local Windows PC.

Before proposing or making ANY code changes, follow this exact workflow:

1. Inspect the downloaded local codebase completely (`package.json`, `server.ts`, `server/`, `src/`, `supabase/`, `.env.example`, and documentation).
2. Read `PROJECT-HANDOVER.md`, `ARCHITECTURE.md`, `DATABASE.md`, `SECURITY.md`, `API.md`, `KNOWN-ISSUES.md`, and `PROJECT-FILE-INDEX.md`.
3. Compare the local codebase against my GitHub repository (`git status`, `git log`, `git diff`) and summarize any differences without blindly overwriting files.
4. Audit the actual implementation before modifying anything. Do not assume code works or assume environment variables are configured without checking.
5. Enforce all core invariants:
   - Never claim website registration blocks calls at the telecom-network level.
   - Never store raw or normalized E.164 phone numbers in `public.phone_registrations` or any DB table (HMAC-SHA256 hash + `phone_last4` + `country_code` only).
   - Keep `public.phone_registrations` RLS enabled with zero public/anon/authenticated policies and access it exclusively server-side via `SUPABASE_SECRET_KEY`.
   - Keep `SUPABASE_SECRET_KEY`, `PHONE_LOOKUP_HMAC_KEY`, `CAN_SERVER_SECRET`, and SMS credentials strictly server-side; never expose them to `src/` or `VITE_*`.
   - Never permit demo OTP in production. Require real SMS credentials, Supabase, persistent secrets, and the supported single-instance Node runtime.
6. Implement changes in small, surgical, testable steps that preserve existing working features and approved CAN Protection branding.
7. After every change, run `npm test`, `npm run lint`, and `npm run build` (and verify live endpoints/UI when applicable).
8. Report only actual observed test outputs, build results, and any remaining blockers—never invent project state or claim unverified success.

Start now by inspecting the local directory structure, Git status/diff, and handover documentation, then report your findings before editing code.
```
