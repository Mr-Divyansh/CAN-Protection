# CAN Protection — Technical Architecture

## Implemented Architecture

```
Browser (React 19 + TypeScript + Vite 8 + Tailwind CSS v4)
   │  Same-Origin JSON + Authorization: Bearer <sessionToken> (in-memory only)
   ▼
Express Server (server.ts + server/routes.ts)
   ├── Input Validation & E.164 Normalization (src/lib/phone.ts)
   ├── Server-Only HMAC-SHA256 Phone Lookup (src/lib/otp-policy.ts + PHONE_LOOKUP_HMAC_KEY)
   ├── OTP Security Policy & Rate Limits (src/lib/otp-policy.ts + server/otp-provider.ts)
   ├── Short-Lived Bearer Session Verification (server/session.ts)
   └── Database Layer (server/db.ts)
         ├── Production Registration Store: @supabase/supabase-js -> public.phone_registrations
         │      (Project: edykghafxrrvsfbcxnkt via SUPABASE_SECRET_KEY, RLS private)
         ├── Development Registration Fallback: Local node:sqlite phone_registrations (hash + last4 + country_code only)
         └── Transient OTP/Session/Rate-Limit Store: Local node:sqlite (single-instance persistent host only; not Vercel/serverless)
```

## Core Trust Boundaries

1. **Zero Client Trust**: All phone validation, E.164 normalization, HMAC-SHA256 phone hashing, OTP generation/verification, rate limiting, and ownership checks execute on the Express server. Browser code never holds `SUPABASE_SECRET_KEY` or `PHONE_LOOKUP_HMAC_KEY` and never accesses Supabase directly.
2. **Zero Raw Phone Persistence**: Phone numbers are normalized in memory to E.164 (`+91...`), converted into keyed HMAC-SHA256 digests (`hashPhoneLookup`), and stored alongside only `phone_last4` and `country_code` for masked UI rendering (`+91 ••••••3210`). Rotating `PHONE_LOOKUP_HMAC_KEY` without migrating hashes makes existing lookups fail to match previously stored rows because raw numbers are never retained.
3. **Strict Ownership Enforcement & Atomic OTP Consumption**: Verified Bearer session tokens (`Authorization: Bearer ...`) are bound server-side to `phone_hash` (`verified_sessions`), `country_code`, and `phone_last4`. Every read/activate/deactivate route operates exclusively on `session.phone_hash`. OTP challenge verification uses an atomic `UPDATE ... WHERE id = ? AND consumed_at IS NULL` check returning `409` on concurrent replay attempts.
4. **No Pre-Verification Enumeration**: `POST /api/otp/request` never discloses whether a mobile number is already present in `phone_registrations`, and unknown `/api/*` paths return structured JSON `404` responses without leaking stack traces.
5. **Fail-Closed Configuration Guards**: Missing `PHONE_LOOKUP_HMAC_KEY` or `SUPABASE_SECRET_KEY` when `SUPABASE_URL` is configured returns `503`. Misconfigured SMS providers fail closed (`503`), and production (`NODE_ENV=production` or `VERCEL=1`) always blocks `demo` OTP mode (`503`). Production also requires Supabase registration storage, a persistent 32+ character `CAN_SERVER_SECRET`, and a persistent SQLite path explicitly enabled for single-instance Node hosting. Vercel/serverless is rejected until transient state is moved to a shared store.

## Product Scope Boundary

CAN Protection provides **verified phone ownership registration and status management**. Website registration does **not** automatically block incoming calls or stop call bombing at the telecom-network level.
