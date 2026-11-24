# CAN Protection — Deployment & Operations Guide

## Architecture Runtime Note

CAN Protection runs as a **React 19 + Vite 8 + TypeScript** frontend paired with an **Express (`server.ts`)** backend serving both `/api/*` and the built `dist/` SPA.

- **Node.js Requirement**: Node.js `>= 22.18.0` (required for `node:sqlite` and native TypeScript execution on `npm start` / `node server.ts`).
- **Windows & Cross-Platform Compatibility**: `server.ts` resolves paths with `fileURLToPath(import.meta.url)` and `npm test` invokes explicit test paths without POSIX shell globs so development works smoothly on Windows, macOS, and Linux.

## External Services Required for Production

1. **Supabase PostgreSQL (`edykghafxrrvsfbcxnkt`)**:
   - Ensure the private `public.phone_registrations` table is present with RLS enabled and **zero** public/`anon`/`authenticated` policies.
   - Set server-only environment variables:
     - `SUPABASE_URL=https://edykghafxrrvsfbcxnkt.supabase.co`
     - `SUPABASE_SECRET_KEY=<your rotated server secret key>`
     - `PHONE_LOOKUP_HMAC_KEY=<32+ character random HMAC secret>`
   - **Never** expose `SUPABASE_SECRET_KEY` or `PHONE_LOOKUP_HMAC_KEY` to the browser or prefix them with `VITE_`.
   - Do **not** rotate `PHONE_LOOKUP_HMAC_KEY` without a migration strategy once records exist in `public.phone_registrations`, because lookups rely on deterministic HMAC-SHA256 digests and raw phone numbers are never stored.
2. **OTP SMS Provider** (see `OTP-PROVIDER-SETUP.md`):
   - Local development defaults to `OTP_PROVIDER=demo` (Twilio/MSG91 variables optional).
   - **Production Fail-Closed Rule**: When `NODE_ENV=production` or `VERCEL=1`, `OTP_PROVIDER` must be `twilio` or `msg91` with valid vendor credentials. Demo OTP is never permitted in production; the old `ALLOW_DEV_OTP_DEMO` variable is ignored.
3. **HTTPS Hosting & Persistent Session Secret**:
   - Serve behind HTTPS with `NODE_ENV=production`.
   - Set a persistent random `CAN_SERVER_SECRET` of at least 32 characters so OTP challenge HMACs and Bearer sessions survive process restarts.
   - **Important runtime restriction**: Transient OTP/session/rate-limit state still uses local `node:sqlite`. Production is permitted only on a single-instance persistent Node host with `CAN_ALLOW_PRODUCTION_SQLITE=true` and an absolute `CAN_SQLITE_PATH`. Vercel/serverless and multi-instance deployments are explicitly rejected until this state is moved to a shared database or Redis.

## Pre-Deployment Checklist

- [ ] Rotate the `sb_secret_...` key previously displayed during setup and set `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and `PHONE_LOOKUP_HMAC_KEY`
- [ ] Set a strong persistent `CAN_SERVER_SECRET` (32+ characters)
- [ ] Verify `/api/health` returns `200`, `ok: true`, `schemaVerified: true`, and `storageBackend: "supabase_postgres"`
- [ ] Configure `OTP_PROVIDER` (`twilio` or `msg91`) + India DLT registration for `+91`; demo OTP is always disabled in production
- [ ] For a single-instance Node host only, set `CAN_ALLOW_PRODUCTION_SQLITE=true` and an absolute persistent `CAN_SQLITE_PATH`; do not deploy this build to Vercel/serverless
- [ ] Confirm `PRIVACY-POLICY.md`, `TERMS.md`, `CONTACT.md`, and `src/components/LegalModal.tsx` with project owner and legal counsel
- [ ] Run `npm run lint`, `npm test`, and `npm run build`, then verify production startup (`NODE_ENV=production npm start`)

## Rollback & Troubleshooting

- **Rollback**: Redeploy previous tagged Git release. Never drop `public.phone_registrations` during a rollback.
- **`503 Supabase server configuration requires valid environment variable(s)`**: Verify `SUPABASE_URL` (`https://`), `SUPABASE_SECRET_KEY`, and `PHONE_LOOKUP_HMAC_KEY` (>= 16 chars) are all set on the server.
- **`503 OTP demo mode is never permitted in production`**: Configure `OTP_PROVIDER=twilio` or `OTP_PROVIDER=msg91` with valid credentials (there is no production override).
