# CAN Protection — Security Requirements

## Sensitive data
Mobile numbers and verification data are sensitive. Collect only what is necessary.

## Mandatory controls
- Verify ownership before revealing registration status or changing it.
- Validate and normalize phone numbers server-side.
- Apply rate limits to OTP sending, OTP verification, and status-changing endpoints.
- Use short-lived, single-use verification codes.
- Never store OTPs as plaintext.
- Keep provider credentials and database service-role secrets server-side.
- Use least-privilege database access policies.
- Do not place phone numbers or OTPs in URLs.
- Do not log OTPs or full phone numbers.
- Prevent number enumeration before ownership verification.
- Require explicit confirmation before deactivation.
- Use HTTPS in production.
- Return safe user-facing errors; never expose stack traces or secrets.

## Threats to test
- OTP brute force and SMS flooding.
- Unauthorized status lookup.
- Changing another user's registration.
- Replaying expired or reused OTPs.
- Duplicate active registrations.
- Direct database access that bypasses server authorization.
- Accidental exposure through logs, analytics, or client bundles.

## Release gate
Do not launch real-number verification until provider configuration, rate limits, authorization, database policies, privacy copy, and failure handling have been reviewed.
