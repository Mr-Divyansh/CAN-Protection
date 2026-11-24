# CAN Protection — Project Memo / Decision Log

Use this file to record important decisions, assumptions, unresolved questions, and changes in scope.

## Current decisions
- Project name: CAN Protection.
- Product type: website, not a mobile app.
- Initial scope: mobile-number ownership verification and CAN Protection registration-status management.
- Users can activate and deactivate their registration.
- Approved logo and four-view UI reference are the visual source of truth.
- Required themes: dark and light.
- Required responsive targets: desktop and mobile.
- Initial hosting target: free-tier deployment where practical; verify current provider limits before release.
- Suggested stack: Next.js + TypeScript + Supabase + Vercel + GitHub.

## Critical product limitation
Registration in the CAN Protection database does not itself block incoming telecom calls. Any future call-blocking capability requires a real, authorized, technically supported integration and testing.

## Open decisions
- Which OTP provider will be used, and what are its current India delivery requirements and costs?
- Is the first release a portfolio demo, limited pilot, or public service?
- What retention/deletion policy will apply to phone-number data?
- Which support/contact channel will be published?
- What exact user-facing language will explain the difference between registration and actual call blocking?

## Decision log
| Date | Decision / change | Reason | Owner |
|---|---|---|---|
| YYYY-MM-DD | Add decisions here | Explain why | Project owner |
