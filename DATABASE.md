# CAN Protection — Database Design & Schema Alignment

## Target Supabase Project
- **Project ID**: `edykghafxrrvsfbcxnkt` (`https://edykghafxrrvsfbcxnkt.supabase.co`)
- **Active Private Table**: `public.phone_registrations` (already created on the target project)
- **Server Client**: `@supabase/supabase-js` initialized server-side only (`server/db.ts`) using `SUPABASE_URL` and `SUPABASE_SECRET_KEY` (with fallback recognition for legacy `SUPABASE_SERVICE_ROLE_KEY`). Client keys are cached by URL, secret digest, and `PHONE_LOOKUP_HMAC_KEY` configuration.

> **Note on Legacy Migration File**: `supabase/migrations/001_init_can_protection.sql` is a legacy migration with raw normalized phone columns and is not aligned with the current schema. Do not run it or use `supabase db push` until remote migration history is reconciled and a safe baseline is prepared. Runtime registration storage integrates directly with the existing `public.phone_registrations` table.

## Existing Table Schema: `public.phone_registrations`

| Column | Type | Purpose / Runtime Handling |
| --- | --- | --- |
| `id` | `uuid` | Primary key generated server-side on insert |
| `phone_number_hash` | `text` | `HMAC-SHA256(PHONE_LOOKUP_HMAC_KEY, e164PhoneNumber)` lookup key |
| `phone_last4` | `text` | Last 4 digits only, used strictly for masked display (`+91 ••••••3210`) |
| `country_code` | `text` | Validated country dial prefix (e.g. `+91`) |
| `status` | `text` | `'active'` or `'inactive'` |
| `verified_at` | `timestamptz` | Timestamp of latest OTP ownership verification |
| `activated_at` | `timestamptz` | Latest activation timestamp |
| `deactivated_at` | `timestamptz` | Latest deactivation timestamp |
| `created_at` | `timestamptz` | Initial record creation timestamp |
| `updated_at` | `timestamptz` | Explicitly updated by application code on every `insert` and `update` |

- **Zero Raw Phone Numbers**: Raw and E.164 phone numbers are **never** stored in `public.phone_registrations` or in transient local tables (`otp_challenges`, `verified_sessions`, `rate_limit_events`). Phone numbers are normalized to E.164 in memory (`src/lib/phone.ts`), hashed via `hashPhoneLookup(e164, PHONE_LOOKUP_HMAC_KEY)`, and immediately discarded after OTP dispatch.
- **HMAC Key Stability (`PHONE_LOOKUP_HMAC_KEY`)**: Because raw numbers are never persisted, existing rows cannot be re-hashed offline if `PHONE_LOOKUP_HMAC_KEY` changes. Keep `PHONE_LOOKUP_HMAC_KEY` stable once live registrations exist.
- **Duplicate Active Prevention**: Every activation checks `phone_number_hash` first, updates existing rows in place, and recovers cleanly from unique-constraint (`23505`) insert races.

## Transient Security Tables (Server-Side Local `node:sqlite`)
Short-lived OTP challenges (`otp_challenges`), verified session hashes (`verified_sessions`), and sliding-window rate-limit buckets (`rate_limit_events`) remain in local server transient `node:sqlite` (`data/can-protection.db` or `CAN_SQLITE_PATH`). Development may use the default path. Production is allowed only on a single-instance persistent Node host with `CAN_ALLOW_PRODUCTION_SQLITE=true`, an absolute `CAN_SQLITE_PATH`, and a persistent `CAN_SERVER_SECRET`; Vercel/serverless and multi-instance hosting are blocked until a shared store is implemented.

## Row Level Security (RLS)
- `public.phone_registrations` keeps RLS enabled with **zero** public, `anon`, or `authenticated` access policies **by design**.
- Do **not** add permissive RLS policies to silence Supabase linter notices about "RLS enabled with no policies"; this table is strictly server-private and is accessed exclusively via `SUPABASE_SECRET_KEY` on the Express server.

## Schema Parity Verification
- `PHONE_REGISTRATIONS_COLUMNS` in `server/db.ts` is explicitly locked to all 10 columns above.
- `verifySchema()` executes a 1-row `select(PHONE_REGISTRATIONS_SELECT).limit(1)` check via `GET /api/health` when Supabase credentials are configured.
- Local SQLite parity, mocked `@supabase/supabase-js` adapter verification, and an earlier in-memory E2E verification against `edykghafxrrvsfbcxnkt` (`GET /api/health` -> `ok: true`, `storageBackend: "supabase_postgres"`, `schemaVerified: true`, plus live status lookup/activate/deactivate) passed. Configure `SUPABASE_URL`, a rotated `SUPABASE_SECRET_KEY`, and a persistent `PHONE_LOOKUP_HMAC_KEY` in `.env` or hosting Secrets for persistent runtime use.
