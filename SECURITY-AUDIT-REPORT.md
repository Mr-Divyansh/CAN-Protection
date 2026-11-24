# CAN Protection — Security Audit Report

**Audit Date**: 2026-11-24  
**Scope**: Frontend (`src/`), Backend (`server.ts`, `server/*.ts`), Supabase Integration (`@supabase/supabase-js` -> `public.phone_registrations`), and Pure Policy Logic (`src/lib/`).

## Verified Security Controls

| Control | Implementation | Verification |
| --- | --- | --- |
| Zero raw phone persistence | All DB tables (`phone_registrations`, `otp_challenges`, `verified_sessions`, `rate_limit_events`) store only HMAC-SHA256 hashes, `phone_last4`, and `country_code`. Legacy SQLite tables with `phone_number_normalized` are dropped on startup. | Verified in `server/db.test.ts` & `server/routes.test.ts` |
| Keyed E.164 phone lookup | `normalizeAndValidatePhone` converts inputs to E.164 before `hashPhoneLookup(e164, PHONE_LOOKUP_HMAC_KEY)`. | Unit tested in `src/lib/otp-policy.test.ts` |
| Server-only secrets boundary | `SUPABASE_SECRET_KEY`, `PHONE_LOOKUP_HMAC_KEY`, `CAN_SERVER_SECRET`, and SMS credentials reside solely in server `process.env`; fail-closed `503` if `SUPABASE_URL` lacks `SUPABASE_SECRET_KEY` or `PHONE_LOOKUP_HMAC_KEY`. | Verified via `server/env.test.ts`, `server/routes.test.ts`, and `src/` grep |
| Production demo-mode fail closed | `NODE_ENV=production` or `VERCEL=1` rejects unset or `demo` `OTP_PROVIDER` (`503`) unless `ALLOW_DEV_OTP_DEMO=true` is explicitly configured. | Verified in `server/env.test.ts` & `server/routes.test.ts` |
| Pre-verification anti-enumeration | `POST /api/otp/request` never discloses whether a number exists in `phone_registrations`; unknown `/api/*` paths return structured JSON `404`. | Tested in `server/routes.test.ts` |
| Non-plaintext OTP storage & timing-safe verification | OTPs hashed via `HMAC-SHA256(pepper, otp:challengeId:code)` and verified with `crypto.timingSafeEqual`. | Unit tested in `src/lib/otp-policy.test.ts` |
| OTP expiry, attempt limits & atomic replay protection | 5-minute TTL (`410`), max 5 attempts per challenge (`429`), and atomic `consumed_at IS NULL` check returning `boolean` (`409` on replay/race). | Unit + API integration tested |
| Rate limiting & resend cooldown | Sliding window limits per IP hash & phone hash + 30s resend cooldown. | Unit + API integration tested (`429`) |
| Ownership-verified Bearer authorization | `/api/registration/*` requires a valid non-revoked `Authorization: Bearer` token bound server-side to `phone_hash`; client never supplies phone numbers or record IDs for lookups/mutations. | Verified `401` without token and after logout in `server/routes.test.ts` |
| Explicit `updated_at` & confirmation-gated deactivation | Every insert/activate/re-verify/deactivate explicitly sets `updated_at`; deactivation requires `{ confirm: true }`. | Verified in `server/db.test.ts` & `server/routes.test.ts` |
| Private Supabase RLS | Integrates private `public.phone_registrations` server-side via `@supabase/supabase-js` with `SUPABASE_SECRET_KEY`; zero `anon`/`authenticated`/public RLS policies added by design. | Verified structurally in `server/db.ts` |

## Remaining External Environment Blockers

1. **Server Secrets Configuration & Key Rotation**: Live integration against `edykghafxrrvsfbcxnkt` passed earlier in-memory, but the container currently has no `.env` file or persistent server secrets (so port `3000` defaults to `local_sqlite_dev`). Rotate the `sb_secret_...` key previously shown in a screenshot, then store `SUPABASE_URL`, the rotated `SUPABASE_SECRET_KEY`, and a persistent `PHONE_LOOKUP_HMAC_KEY` in `.env` (local) or server Secrets (hosting).
2. **Simulated OTP in Demo Mode**: Until `OTP_PROVIDER` (`twilio` or `msg91`) is configured with live SMS credentials and India DLT registration, OTP delivery uses `OTP_PROVIDER=demo` (Development Test Mode).
3. **Persistent Session Pepper**: Configure `CAN_SERVER_SECRET` in production so active sessions remain valid across server restarts.
4. **Legal & Retention Policies**: `PRIVACY-POLICY.md`, `TERMS.md`, and `CONTACT.md` contain `[TODO]` placeholders pending owner confirmation.
