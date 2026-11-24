# Project Roles and Responsibilities

This is a solo project. One person may perform multiple roles.

## Product Owner
- Owns the product vision, scope, priorities, and final decisions.
- Approves requirements and user-facing claims.

## UI/UX Designer
- Follows `DESIGN.md` and approved visual references.
- Maintains desktop/mobile and dark/light consistency.
- Checks accessibility and responsive behavior.

## Frontend Developer
- Builds pages, forms, themes, loading states, and accessible components.
- Never treats frontend-only checks as security controls.

## Backend Developer
- Implements server-side validation, verification, status checks, activation, and deactivation.
- Enforces authorization and rate limits on the server.

## Database Owner
- Designs schema, constraints, indexes, and access policies.
- Prevents unauthorized access to phone-number records.

## Security Reviewer
- Reviews OTP abuse prevention, enumeration risks, secrets handling, authorization, logs, and privacy.
- Records unresolved risks before release.

## QA Tester
- Tests normal flows, edge cases, mobile layouts, themes, and failure states.

## Release Owner
- Manages environment variables, deployment, production checks, and rollback readiness.

## Decision rule
No role may silently expand scope or claim a security capability that has not been implemented and tested. Record significant decisions in `MEMO.md`.
