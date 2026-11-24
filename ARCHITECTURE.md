# CAN Protection — Technical Architecture

## Proposed high-level flow
Browser → Next.js server endpoints → verification provider / Supabase PostgreSQL

The browser must not use privileged database credentials. The server validates input, verifies the user's authorization, and performs registration operations.

## Suggested components
- Next.js + TypeScript frontend.
- Server-side route handlers for verification and registration actions.
- Supabase PostgreSQL for registration records.
- OTP provider selected after pricing and regional support review.
- Vercel for deployment, subject to current free-tier limits.
- GitHub for source control.

## Core operations
1. Request verification.
2. Verify code and establish a short-lived verified session.
3. Check the verified user's registration.
4. Activate registration.
5. Deactivate registration after confirmation.

## Architecture rules
- Never reveal registration status before ownership verification.
- Never trust frontend-only authorization.
- Keep secrets server-side.
- Use database constraints to prevent duplicate active registrations.
- Fail closed if verification or the database is unavailable.
- Clearly distinguish development/test mode from real verification.
