# CAN Protection

**Protect Yourself. Stay Connected.**

CAN Protection is a privacy-first cybersecurity web application for **mobile-number ownership verification** and **call-safety registration status management**.

## Implemented Features

- Country-aware mobile number validation and in-memory E.164 normalization (`+91` India default, plus `+1`, `+44`, `+61`, `+65`, `+971`, `+49`, `+81`).
- Server-side OTP ownership verification (`HMAC-SHA256` hashed codes, 5-minute TTL, 30s resend cooldown, max 5 attempts, atomic single-use replay prevention, and atomic sliding-window IP/number rate limiting).
- **Development Test Mode** (`OTP_PROVIDER=demo`) is available locally without SMS credentials; it is unconditionally disabled in production, where a real provider (`twilio` or `msg91`) is required.
- Verification-gated registration status lookup, duplicate-safe activation, and confirmation-required deactivation (`active` / `inactive`).
- Zero raw phone numbers stored in the database: numbers are normalized to E.164 in memory and queried via keyed `HMAC-SHA256` (`PHONE_LOOKUP_HMAC_KEY`), storing only `phone_number_hash`, `phone_last4`, and `country_code`.
- Integrates existing private Supabase table `public.phone_registrations` (`edykghafxrrvsfbcxnkt`) via `@supabase/supabase-js` (`SUPABASE_URL` + `SUPABASE_SECRET_KEY`), with local `node:sqlite` registration fallback only during development. Production refuses this fallback.
- Responsive Desktop & Mobile UI with Dark Mode (`#0C0F13`) and Light Mode (`#F4F1EA`) using the approved CAN Protection brand assets.

## Important Technical Limitation

Registering a mobile number in CAN Protection does **not** independently block incoming calls or stop call bombing at the telecom-network level. Actual call blocking requires authorized telecom carrier or OS-level integration.

## Local Development Setup (Windows / macOS / Linux)

- **Prerequisite**: Node.js `>= 22.18.0` LTS
- **1. Install dependencies**:
  ```bash
  npm install
  ```
- **2. Configure environment**:
  Copy `.env.example` to `.env`. Keep `OTP_PROVIDER=demo` for local development without SMS credentials. Leave `SUPABASE_*` blank for local SQLite development, or set `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and `PHONE_LOOKUP_HMAC_KEY` to connect to Supabase. Never use local SQLite as production registration storage.
- **3. Run & verify**:
  ```bash
  npm run dev      # Start Express + Vite dev server on http://localhost:3000
  npm test         # Run all 26 unit, DB adapter, and HTTP API tests
  npm run lint     # Run TypeScript check (tsc --noEmit)
  npm run build    # Build production frontend bundle to dist/
  npm run start    # Start production server (requires Supabase, real OTP, persistent secrets, and supported single-instance Node hosting)
  ```

## Documentation Index

- `PROJECT-HANDOVER.md` — Complete local handover guide and ChatGPT continuation prompt
- `PROJECT-FILE-INDEX.md` — Directory and file purpose reference
- `KNOWN-ISSUES.md` — Unresolved blockers, limitations, and operational caveats
- `ARCHITECTURE.md` & `DATABASE.md` — System boundaries, `public.phone_registrations` schema, and RLS notes
- `API.md` — Express `/api/*` endpoint specification
- `SECURITY.md` & `SECURITY-AUDIT-REPORT.md` — Controls, threat boundaries, and audit findings
- `TESTING.md` — Automated, mocked, live Supabase, and browser test results
- `DEPLOYMENT.md` & `OTP-PROVIDER-SETUP.md` — Hosting, secrets, and Twilio/MSG91/DLT setup
- `PRD.md`, `DESIGN.md`, `ROLES.md`, `MEMO.md`, `CHANGELOG.md` — Specs, design tokens, decisions, and history
- `PRIVACY-POLICY.md`, `TERMS.md`, `CONTACT.md` — Draft legal templates pending owner review
