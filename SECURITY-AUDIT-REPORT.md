# CAN Protection — Security Audit Report

**Audit Date**: 2026-11-24  
**Scope**: Frontend (`src/`), Backend (`server.ts`, `server/*.ts`), Supabase Integration (`@supabase/supabase-js` -> `public.phone_registrations`), and Pure Policy Logic (`src/lib/`).

## Verified Security Controls

> A follow-up code review identified and fixed a concurrent OTP-attempt race. The follow-up CI run for the added atomic-attempt implementation is pending; do not treat this follow-up as CI-verified until that run passes.

> The hardening branch passed GitHub Actions run [#45441058863](https://github.com/Mr-Divyansh/CAN-Protection/actions/runs/45441058863): dependency install, TypeScript check, all 26 automated tests, and Vite production build. Production credentials, live SMS, and deployment were not exercised.

| Control | Implementation | Verification |
| --- | --- | --- |
| Zero raw phone persistence | All DB tables (`phone_registrations`, `otp_challenges`, `verified_sessions`, `rate_limit_events`) store only HMAC-SHA256 hashes, `phone_last4`, and `country_code`. Legacy SQLite tables with `phone_number_normalized` are dropped on startup. | Verified in `server/db.test.ts` & `server/routes.test.ts` |
| Keyed E.164 phone lookup | `normalizeAndValidatePhone` converts inputs to E.164 before `hashPhoneLookup(e164, PHONE_LOOKUP_HMAC_KEY)`; configured key must be at least 32 characters. | Unit tested in `src/lib/otp-policy.test.ts` and `server/env.test.ts` |
| Server-only secrets boundary | `SUPABASE_SECRET_KEY`, `PHONE_LOOKUP_HMAC_KEY`, `CAN_SERVER_SECRET`, and SMS credentials reside solely in server `process.env`; fail-closed `503` if `SUPABASE_URL` lacks `SUPABASE_SECRET_KEY` or `PHONE_LOOKUP_HMAC_KEY`. | Verified via `server/env.test.ts`, `server/routes.test.ts`, and `src/` grep |
| Production demo-mode fail closed | `NODE_ENV=production` or `VERCEL=1` always rejects unset or `demo` `OTP_PROVIDER` (`503`); no override exists. | Covered by `server/env.test.ts`; CI passed |
| Pre-verification anti-enumeration | `POST /api/otp/request` never discloses whether a number exists in `phone_registrations`; unknown `/api/*` paths return structured JSON `404`. | Tested in `server/routes.test.ts` |
| Non-plaintext OTP storage & timing-safe verification | OTPs hashed via `HMAC-SHA256(pepper, otp:challengeId:code)` and verified with `crypto.timingSafeEqual`. | Unit tested in `src/lib/otp-policy.test.ts` |
| OTP expiry, attempt limits & atomic replay protection | 5-minute TTL (`410`), max 5 attempts per challenge enforced with a conditional atomic update (`429`), and atomic `consumed_at IS NULL` check (`409` on replay/race). | Unit + API integration tests, including concurrent invalid submissions |
| Rate limiting & resend cooldown | Atomic SQLite transaction reserves each sliding-window event per IP hash & phone hash; 30s resend cooldown. Caller-supplied `X-Forwarded-For` is not trusted by default. | API integration test covers concurrent requests and spoofed forwarding headers |
| Ownership-verified Bearer authorization | `/api/registration/*` requires a valid non-revoked `Authorization: Bearer` token bound server-side to `phone_hash`; client never supplies phone numbers or record IDs for lookups/mutations. | Verified `401` without token and after logout in `server/routes.test.ts` |
| Explicit `updated_at` & confirmation-gated deactivation | Every insert/activate/re-verify/deactivate explicitly sets `updated_at`; deactivation requires `{ confirm: true }`. | Verified in `server/db.test.ts` & `server/routes.test.ts` |
| Private Supabase RLS | Integrates private `public.phone_registrations` server-side via `@supabase/supabase-js` with `SUPABASE_SECRET_KEY`; zero `anon`/`authenticated`/public RLS policies added by design. | Verified structurally in `server/db.ts` |

## Additional Production Guards in the Hardening Branch

- Production refuses to use SQLite as the registration-store fallback when Supabase configuration is absent.
- Production requires a persistent `CAN_SERVER_SECRET` of at least 32 characters.
- The current transient OTP/session/rate-limit implementation still uses local SQLite; only a single-instance persistent Node host can opt into this mode with `CAN_ALLOW_PRODUCTION_SQLITE=true` and an absolute `CAN_SQLITE_PATH`.
- Vercel/serverless is explicitly rejected until transient state is migrated to a shared store.
- `ALLOW_DEV_OTP_DEMO` no longer enables demo OTP in production.

## Remaining External Environment Blockers

1. **Server Secrets Configuration & Key Rotation**: Live integration against `edykghafxrrvsfbcxnkt` passed earlier in-memory, but no current runtime credentials are available in this audit context. Production now rejects missing Supabase credentials rather than silently using SQLite. The old raw-phone migration is archived outside the active migration directory. The two timestamped active migration files mirror the two versions recorded in the connected project; verify `supabase migration list` before future pushes. Rotate the `sb_secret_...` key previously shown in a screenshot, then store `SUPABASE_URL`, the rotated `SUPABASE_SECRET_KEY`, and a persistent `PHONE_LOOKUP_HMAC_KEY` in `.env` (local) or server Secrets (hosting).
2. **Development-only simulated OTP**: `OTP_PROVIDER=demo` works only outside production. Production always requires live Twilio or MSG91 credentials and applicable India DLT registration.
3. **Persistent Session Pepper**: Production requires a persistent random `CAN_SERVER_SECRET` of at least 32 characters.
4. **Legal & Retention Policies**: `PRIVACY-POLICY.md`, `TERMS.md`, and `CONTACT.md` contain `[TODO]` placeholders pending owner confirmation.
