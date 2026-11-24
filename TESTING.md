# CAN Protection — Test Plan

## Functional
- Valid and invalid phone numbers.
- OTP success, failure, expiry, retry, and rate limit.
- New registration activation.
- Existing active registration check.
- Deactivation after verification and confirmation.
- Re-activation after deactivation.
- Duplicate active registration prevention.
- Expired session behavior.
- Provider/database outage behavior.

## Security
- Status lookup without verification is denied.
- User A cannot view or change User B's registration.
- OTP brute-force attempts are rate-limited.
- Reused OTPs are rejected.
- Secrets are absent from frontend bundles and logs.
- Database policies prevent unauthorized direct access.
- Full phone numbers are absent from URLs.

## UI
- Desktop dark mode.
- Desktop light mode.
- Mobile dark mode.
- Mobile light mode.
- Keyboard navigation and visible focus.
- Form validation and all loading/error/success states.

## Record results
For each test, record: test name, expected result, actual result, pass/fail, and date.
