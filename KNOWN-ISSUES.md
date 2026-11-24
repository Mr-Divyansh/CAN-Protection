# CAN Protection — Known Issues & Unresolved Blockers

1. **Supabase Secret Key Rotation & Persistent Secret Injection Required**
   - A `sb_secret_...` key screenshot was shared during AI Studio setup and must be rotated/revoked in the Supabase Dashboard (`edykghafxrrvsfbcxnkt`).
   - Because secrets are never committed or stored in source files, local development or hosting deployments require configuring `SUPABASE_URL`, a rotated `SUPABASE_SECRET_KEY`, and a persistent `PHONE_LOOKUP_HMAC_KEY` in `.env` (local) or server Secrets (hosting) before `storageBackend: "supabase_postgres"` is active at runtime.

2. **Live Telecom SMS Delivery Not Verified**
   - `OTP_PROVIDER=twilio` and `OTP_PROVIDER=msg91` adapters are implemented, but live SMS delivery has not been tested because vendor credentials and India TRAI DLT registration have not been provisioned.
   - Until configured, development runs under `OTP_PROVIDER=demo` (`Development Test Mode`).

3. **Persistent Production Session Secret Required**
   - Production now refuses to start API operations unless `CAN_SERVER_SECRET` is a persistent random value of at least 32 characters. Development may still use an ephemeral fallback.

4. **Single-Instance Local SQLite Store for Transient OTP/Session/Rate-Limit Data**
   - Only `public.phone_registrations` is stored in remote Supabase (per the constraint not to create extra remote tables).
   - `otp_challenges`, `verified_sessions`, and `rate_limit_events` are stored in local `node:sqlite` (`data/can-protection.db` or `CAN_SQLITE_PATH`).
   - Consequence: Multi-instance horizontal scaling and stateless serverless platforms cannot safely share OTP challenges, active sessions, or rate-limit counters. The production environment validator now blocks these deployments; a shared store (e.g., Redis or PostgreSQL tables) is required before enabling them.

5. **HMAC Key Rotation Limitation (`PHONE_LOOKUP_HMAC_KEY`)**
   - Because raw phone numbers are intentionally never stored, changing `PHONE_LOOKUP_HMAC_KEY` without an online migration/re-hashing plan will prevent lookups from matching previously stored `phone_number_hash` rows.

6. **Draft Legal & Contact Placeholders**
   - `PRIVACY-POLICY.md`, `TERMS.md`, `CONTACT.md`, and `src/components/LegalModal.tsx` contain `[TODO]` / pending-review notices for entity operator name, official support/privacy/security contacts, data retention schedule, and governing jurisdiction.

7. **Migration History & Legacy SQL**
   - `supabase/migrations/001_init_can_protection.sql` is an older schema containing raw normalized phone-number columns and does not match the current `public.phone_registrations` schema. Do not run `supabase db push` until the remote migration history is reconciled and a clean baseline is prepared. The live table must remain server-only with RLS enabled and no anon/authenticated policies.

8. **Lockfile & Automated Cleanup**
   - The workspace includes `bun.lock`; on Windows PCs using `npm`, running `npm install` will generate `package-lock.json`.
   - Expired `otp_challenges` and revoked/expired `verified_sessions` rows in SQLite are not pruned by a background cron job (only `rate_limit_events` prunes old entries on write).
