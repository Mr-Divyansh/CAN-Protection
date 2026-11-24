# CAN Protection — Security Requirements

- Verify mobile-number ownership via OTP challenge and short-lived in-memory Bearer session before revealing or modifying `phone_registrations`.
- Normalize all phone numbers to E.164 (`src/lib/phone.ts`) before hashing with server-only `PHONE_LOOKUP_HMAC_KEY` (`HMAC-SHA256`).
- Never store raw or normalized E.164 phone numbers in any database table (`phone_registrations`, `otp_challenges`, `verified_sessions`, `rate_limit_events`); persist only `phone_number_hash` / `phone_hash`, `phone_last4`, and `country_code`. Because raw numbers are discarded, do not rotate `PHONE_LOOKUP_HMAC_KEY` without a planned migration/re-verification strategy.
- Store OTPs and Bearer session tokens strictly as HMAC-SHA256 hashes (never plaintext) and verify OTP codes with `crypto.timingSafeEqual`.
- Enforce 5-minute OTP expiry (`410`), max 5 verification attempts (`429`), atomic single-use replay consumption (`409` if already consumed), 30s resend cooldown, and sliding-window IP/number rate limits.
- Fail closed (`503`) whenever production (`NODE_ENV=production` or `VERCEL=1`) lacks a configured real SMS provider (`OTP_PROVIDER=twilio` or `msg91`). Demo OTP is never permitted in production; `ALLOW_DEV_OTP_DEMO` has no effect.
- Production requires Supabase registration storage, a persistent 32+ character `CAN_SERVER_SECRET`, and a persistent SQLite path explicitly enabled for single-instance Node hosting. Vercel/serverless and multi-instance deployments are blocked until transient state uses a shared store.
- IP rate-limit identity uses Express `req.ip`; no raw client-supplied `X-Forwarded-For` header is trusted unless a verified proxy hop count is explicitly configured. Rate-limit checks and reservations run in a SQLite `BEGIN IMMEDIATE` transaction so concurrent requests cannot race past the configured limits.
- Require explicit confirmation (`{ confirm: true }`) for deactivation and explicitly update `updated_at` on every `phone_registrations` change.
- Keep `SUPABASE_SECRET_KEY`, `PHONE_LOOKUP_HMAC_KEY`, `CAN_SERVER_SECRET`, and OTP provider keys strictly in server-side `process.env` (never exposed to browser bundles or responses).
- Keep RLS enabled on `public.phone_registrations` intentionally with **zero** `anon`/`authenticated`/public access policies, accessing the table exclusively through the Express server using `SUPABASE_SECRET_KEY`.
