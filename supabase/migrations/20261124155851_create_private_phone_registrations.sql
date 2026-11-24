-- Existing remote migration: 20261124155851_create_private_phone_registrations
-- Private registration store. Only keyed phone hashes are persisted; never store
-- raw or normalized phone numbers in this table.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.phone_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number_hash text NOT NULL UNIQUE,
  phone_last4 text NOT NULL CHECK (phone_last4 ~ '^[0-9]{4}$'),
  country_code text NOT NULL DEFAULT '+91',
  status text NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive')),
  verified_at timestamptz,
  activated_at timestamptz,
  deactivated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT phone_hash_not_empty CHECK (length(phone_number_hash) >= 32)
);

ALTER TABLE public.phone_registrations ENABLE ROW LEVEL SECURITY;

-- Browser-facing roles receive no direct table privileges or policies.
REVOKE ALL ON TABLE public.phone_registrations FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.phone_registrations TO service_role;

COMMENT ON TABLE public.phone_registrations IS
  'Private CAN Protection registration records. Store only a keyed HMAC of the normalized phone number, never the raw phone number. Access is server-side only.';
COMMENT ON COLUMN public.phone_registrations.phone_number_hash IS
  'Keyed HMAC-SHA256 of normalized E.164 phone number. Requires a server-only PHONE_LOOKUP_HMAC_KEY.';
COMMENT ON COLUMN public.phone_registrations.phone_last4 IS
  'Last four digits for limited display; do not use for lookup or authentication.';
