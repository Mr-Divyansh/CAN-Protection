# CAN Protection — Privacy Policy (Draft Template)

> **Status**: Draft awaiting Project Owner confirmation and qualified legal review prior to public production launch. Placeholder `[TODO]` items must be completed before publishing.

## 1. Data Controller
- **Operator / Entity Name**: `[TODO: Confirm legal operator or project owner name]`
- **Contact Channel**: `[TODO: Confirm official privacy/support contact]`

## 2. Information Processed
When you use CAN Protection, the service processes only the minimal data needed for ownership verification and registration status management:
- **Mobile Number (In-Memory Only)**: Submitted mobile numbers are normalized to E.164 format in server memory to deliver the verification code and compute a keyed cryptographic hash (`HMAC-SHA256`). Raw or full E.164 phone numbers are **not** stored in the database; only the cryptographic hash, country code, and last 4 digits (`phone_last4`) are persisted.
- **Verification Metadata**: Cryptographic OTP hashes (never plaintext codes), verification attempt counts, challenge expiration, and short-lived session token hashes.
- **Registration Record**: Status (`active` or `inactive`) and verification/activation/deactivation/update timestamps (`public.phone_registrations`).
- **Abuse-Prevention Signals**: Hashed IP and hashed phone rate-limit timestamps.

## 3. What We Do Not Access
CAN Protection does **not** access device call logs, SMS inboxes, contacts, microphone, or location.

## 4. Sub-Processors & Hosting
- **Database**: Supabase PostgreSQL (`edykghafxrrvsfbcxnkt`, private `public.phone_registrations` table) — `[TODO: Confirm hosting region & DPA before production]`
- **SMS OTP Provider**: `[TODO: Confirm selected OTP provider (e.g., Twilio or MSG91) before production]`
- **Application Hosting**: `[TODO: Confirm hosting provider and region]`

## 5. Retention & Deletion
- **Retention Period**: `[TODO: Owner must define retention schedule for inactive registrations and rate-limit logs]`
- **Deletion Requests**: Users may deactivate their registration immediately inside the verified status panel. Full record deletion procedures require `[TODO: official contact channel]`.
