# CAN Protection — Project Memo / Decision Log

## Current Decisions
- **Project Name**: CAN Protection (`Protect Yourself. Stay Connected.`)
- **Product Type**: Responsive website (Desktop & Mobile, Dark & Light themes).
- **Runtime Adaptation**: **React 19 + Vite 8 + TypeScript + Express (`server.ts`)** full-stack environment requiring Node.js `>= 22.18.0`.
- **Database Strategy**: Dual adapter in `server/db.ts`:
  - Uses `@supabase/supabase-js` with server-only `SUPABASE_URL` + `SUPABASE_SECRET_KEY` and HMAC-SHA256 phone lookup (`PHONE_LOOKUP_HMAC_KEY`) targeting existing private table `public.phone_registrations` on project `edykghafxrrvsfbcxnkt`.
  - Uses local `node:sqlite` (`data/can-protection.db`) when Supabase variables are absent, plus local transient SQLite tables for short-lived `otp_challenges`, `verified_sessions`, and `rate_limit_events`.
  - **Zero raw phone numbers** are persisted in any database table (`phone_number_hash`, `phone_last4`, and `country_code` only).
- **OTP Verification Strategy**: Supports `demo`, `twilio`, and `msg91` providers (`server/env.ts` + `server/otp-provider.ts`). `OTP_PROVIDER=demo` requires zero Twilio/MSG91 credentials in development and fails closed under `NODE_ENV=production` / `VERCEL=1` unless `ALLOW_DEV_OTP_DEMO=true`.

## Open Decisions (Require Project Owner Input)
1. Rotate the `sb_secret_...` Supabase secret key and inject `SUPABASE_URL`, rotated `SUPABASE_SECRET_KEY`, `PHONE_LOOKUP_HMAC_KEY`, and `CAN_SERVER_SECRET` into local `.env` / hosting Secrets.
2. Confirm live production SMS provider (`MSG91` vs `Twilio`) and India TRAI DLT registration for `+91` delivery.
3. Confirm data retention/deletion policy, governing jurisdiction, and official contact details (`PRIVACY-POLICY.md`, `TERMS.md`, `CONTACT.md`, `src/components/LegalModal.tsx`).
4. Decide whether single-instance stateful hosting suffices initially or if transient OTP/session tables should later migrate to Redis / dedicated Supabase tables for horizontal scaling.

## Decision Log
| Date | Decision / Change | Reason | Owner |
| --- | --- | --- | --- |
| 2026-11-24 | Integrated existing `public.phone_registrations` via `@supabase/supabase-js` and `PHONE_LOOKUP_HMAC_KEY` | Aligns with existing private table schema on `edykghafxrrvsfbcxnkt` while guaranteeing zero raw phone numbers stored in DB | Engineering Team |
| 2026-11-24 | Made Twilio/MSG91 env vars optional under `OTP_PROVIDER=demo` | Eliminates unnecessary third-party secrets in demo/local environments without weakening real-provider validation | Engineering Team |
| 2026-11-24 | Stored verified session Bearer token in React memory only | Prevents token exposure via `localStorage`/XSS and eliminates cookie CSRF risks in iframe preview | Security Review |
| 2026-11-24 | Completed final audit, production demo fail-closed guard, atomic OTP consumption, Windows portability, unused dep/file cleanup, and handover docs | Prepares CAN Protection for local Windows development, GitHub repository setup, and continued ChatGPT maintenance outside AI Studio | Final Handover Audit |
