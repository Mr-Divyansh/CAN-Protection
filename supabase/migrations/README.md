# Supabase migrations

The timestamped SQL files in this directory mirror the two migrations already recorded
in the connected CAN Protection Supabase project:

- `20261124155837_revoke_public_execute_rls_auto_enable`
- `20261124155851_create_private_phone_registrations`

They were reconstructed from the live migration names and verified live table schema.
They do not create public policies or expose registration rows to browser roles.

The old `001_init_can_protection.sql` file has been moved to `supabase/legacy/`
because it created obsolete tables containing raw normalized phone-number fields.
**Never execute archived legacy SQL.**

Before any future `supabase db push`, run `supabase migration list` and verify that
local and remote versions match. Do not use `db push` to apply the archived file.
