# CAN Protection — Product Requirements Document

**Status**: MVP v0.1 Implemented  
**Product**: Responsive Website  
**Tagline**: Protect Yourself. Stay Connected.

## Product Summary
CAN Protection lets a user verify ownership of their mobile number, check their CAN Protection registration status, and activate or deactivate that registration securely.

## Critical Technical Limitation
A website registration alone cannot block calls at the telecom-network level. CAN Protection does not claim call blocking, spam detection, or carrier-level interception; it provides verified registration/status management and call-safety guidance.

## MVP Acceptance Criteria
- [x] Mobile-number input with India (`+91`) as default and server-side E.164 normalization.
- [x] Ownership verification (OTP with clearly labelled Development Test Mode fallback when live SMS credentials are absent) before revealing or changing status.
- [x] Check registration status (`not_registered`, `active`, `inactive`).
- [x] Duplicate-safe server-side activation.
- [x] Confirmation-required server-side deactivation.
- [x] Rate limiting, replay protection, and no sensitive phone/OTP exposure in URLs or logs.
- [x] Desktop & Mobile responsive layouts in both Dark Mode and Light Mode.
