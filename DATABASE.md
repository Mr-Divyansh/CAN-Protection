# CAN Protection — Database Notes

## Suggested table: `registrations`

| Column | Type (suggested) | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `phone_number_normalized` | text | Sensitive; restrict access |
| `status` | text/enum | `active` or `inactive` |
| `verified_at` | timestamptz | Ownership verification time |
| `created_at` | timestamptz | Creation time |
| `updated_at` | timestamptz | Last update |
| `activated_at` | timestamptz | Latest activation |
| `deactivated_at` | timestamptz | Latest deactivation |

## Rules
- Normalize numbers consistently before storage and lookup.
- Enforce one active registration per normalized number.
- Restrict reads and writes to authorized server-side operations.
- Do not expose a public endpoint for arbitrary number lookups.
- Define retention and deletion behavior before production.
- Do not store OTP values in this table.
