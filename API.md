# CAN Protection — API Contract (Proposed)

Route names are provisional. Preserve the authorization behavior even if paths change.

## Request verification
- Input: mobile number and country code.
- Validate format and apply rate limits.
- Request a code from the configured provider.
- Response must not disclose whether the number is registered.

## Verify code
- Input: verification challenge and code.
- Reject invalid, expired, reused, or excessive attempts.
- Establish a short-lived verified session.

## Check registration
- Requires verified ownership.
- Returns only the verified user's registration state.

## Activate
- Requires verified ownership.
- Creates or reactivates registration.
- Prevents duplicate active records.

## Deactivate
- Requires verified ownership.
- Requires explicit confirmation.
- Sets status to inactive and records the timestamp.

All inputs must be validated server-side. Never accept a phone number from the client as proof of authorization.
