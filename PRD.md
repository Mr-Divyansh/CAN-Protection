# CAN Protection — Product Requirements Document

**Status:** Draft v1.0  
**Product:** Responsive website  
**Tagline:** Protect Yourself. Stay Connected.

## Product summary
CAN Protection lets a user verify ownership of their mobile number, check their CAN Protection registration status, and activate or deactivate that registration.

## Important limitation
A website registration alone cannot block calls at the telecom-network level. Do not claim that CAN Protection blocks spam, fake, automated, or repeated calls unless a real, tested integration provides that capability. In the MVP, describe the feature as registration/status management.

## MVP goals
- Responsive website for desktop and mobile.
- Dark and light themes.
- Mobile-number input with India (+91) as the initial default.
- Ownership verification before revealing or changing registration status.
- Check registration status.
- Activate registration.
- Deactivate registration after confirmation.
- Secure handling of phone numbers and verification attempts.

## MVP non-goals
- Carrier-level call blocking.
- Access to device call logs, SMS, or contacts.
- Public lookup of arbitrary phone numbers.
- Mobile app.

## Main user flow
1. Enter mobile number.
2. Validate number format.
3. Verify ownership using a legitimate OTP provider or clearly labelled development test mode.
4. Check registration status.
5. If inactive/not registered, offer activation.
6. If active, show status and allow deactivation after confirmation.

## Required states
- Empty form, invalid number, verification requested, incorrect/expired OTP, rate limited.
- Active registration, no active registration, activation success, deactivation confirmation, deactivation success.
- Network/provider/server errors.

## Design
Use the approved CAN Protection logo supplied by the project owner. Brand palette:
- `#0C0F13` deep black
- `#2F7EF2` primary blue
- `#6FB2FF` light blue
- `#F4F1EA` off-white
- `#C3CAD6` silver

Required combinations: desktop dark, desktop light, mobile dark, mobile light.

## Suggested stack
Next.js, TypeScript, Tailwind CSS or CSS Modules, Supabase PostgreSQL, Vercel, and GitHub. Choose an OTP provider only after checking current availability, India requirements, and pricing.

## Acceptance criteria
- Ownership is verified before status disclosure or status changes.
- Activation and deactivation work server-side.
- Duplicate active registrations are prevented.
- Rate limits are enforced.
- Sensitive data is not exposed in URLs, client bundles, or logs.
- Responsive layouts and both themes work.
- Product copy accurately describes what the service does.
