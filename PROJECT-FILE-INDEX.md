# CAN Protection — Project File Index

## Root Configuration & Entry Points
- `package.json` — Scripts (`dev`, `start`, `build`, `lint`, `test`), Node engine (`>=22.18.0`), and runtime/dev dependencies.
- `bun.lock` — Package lockfile from container build environment (`npm install` creates `package-lock.json` locally if using `npm`).
- `.env.example` — Safe environment variable template with zero secret values.
- `.gitignore` — Excludes `node_modules/`, `dist/`, `.env*` (preserving `.env.example`), `data/`, and `*.db*` files.
- `tsconfig.json` — TypeScript configuration (`ES2022`, `bundler` resolution, `noEmit`).
- `vite.config.ts` — Vite 8 + React + Tailwind v4 configuration.
- `index.html` — HTML document root, SEO metadata, Google Fonts (`Plus Jakarta Sans`, `DM Sans`, `JetBrains Mono`), and flash-free theme initializer.
- `metadata.json` — Application name and description metadata.
- `server.ts` — Express server entry point mounting `/api` routes and Vite dev middleware (or static `dist/` in production).

## Backend (`server/`)
- `server/env.ts` — Validates `OTP_PROVIDER` (with fail-closed production check) and Supabase/HMAC storage configuration (`SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `PHONE_LOOKUP_HMAC_KEY`).
- `server/db.ts` — Dual database layer: `@supabase/supabase-js` adapter targeting `public.phone_registrations` (10-column schema lock + schema check) and development-only local registration fallback + local transient OTP/session/rate-limit tables (production opt-in is restricted to persistent single-instance Node hosts).
- `server/session.ts` — Server pepper, `PHONE_LOOKUP_HMAC_KEY` accessor, Bearer token generation/hashing, and `requireVerifiedSession` middleware.
- `server/otp-provider.ts` — OTP generation (`crypto.randomInt`) and dispatch adapters for `demo`, `twilio`, and `msg91`.
- `server/routes.ts` — Express `/api/*` router (`/health`, `/otp/request`, `/otp/verify`, `/session/logout`, `/registration/status`, `/registration/activate`, `/registration/deactivate`, plus API 404 handler).
- `server/env.test.ts`, `server/db.test.ts`, `server/routes.test.ts` — Automated tests for env guards, mocked Supabase adapter, SQLite privacy/migration checks, and full HTTP endpoints.

## Frontend (`src/` & `public/`)
- `src/main.tsx` — React 19 DOM entry point.
- `src/index.css` — Tailwind CSS v4 import, `@custom-variant dark`, and font variables.
- `src/App.tsx` — Main stateful orchestration for theme toggle, phone submission, OTP verification, in-memory Bearer session, status/activate/deactivate calls, and legal dialog.
- `src/types/can.ts` — Shared TypeScript interfaces for API payloads and theme state.
- `src/lib/phone.ts` & `src/lib/phone.test.ts` — Country allowlist, client/server E.164 normalization, `last4` extraction, masking helpers, and unit tests.
- `src/lib/otp-policy.ts` & `src/lib/otp-policy.test.ts` — OTP hashing/verification, `hashPhoneLookup` (HMAC-SHA256), challenge state evaluation, sliding-window rate limits, transition rules, and unit tests.
- `src/components/Navbar.tsx` — Sticky header with CAN Protection logo, navigation links, dark/light toggle, and mobile drawer.
- `src/components/HeroSection.tsx` — Hero banner, country-code selector, phone input form, and official shield emblem.
- `src/components/ProtectionPortal.tsx` — Verification-gated portal for idle preview, OTP entry, active/inactive registration management, and confirmed deactivation dialog.
- `src/components/HowItWorksSection.tsx` — 3-step verification and management overview.
- `src/components/SafetySection.tsx` — 6 practical call-safety guidance cards.
- `src/components/AboutSection.tsx` — Platform scope and explicit technical limitation (no telecom-level call blocking).
- `src/components/Footer.tsx` & `src/components/LegalModal.tsx` — Footer links and draft privacy/terms/contact modal.
- `public/assets/` — Approved official logo, dark/light assets, `app-icon.png`, and `favicon.png`.

## Database Reference (`supabase/`)
- `supabase/legacy/001_init_can_protection.sql` — Archived legacy raw-phone schema; never execute. Timestamped files under `supabase/migrations/` mirror the live migration history.

## Documentation (`*.md`, `LOOP.txt`)
- `README.md`, `PROJECT-HANDOVER.md`, `PROJECT-FILE-INDEX.md`, `KNOWN-ISSUES.md`, `ARCHITECTURE.md`, `DATABASE.md`, `API.md`, `SECURITY.md`, `SECURITY-AUDIT-REPORT.md`, `TESTING.md`, `DEPLOYMENT.md`, `OTP-PROVIDER-SETUP.md`, `PRD.md`, `DESIGN.md`, `ROLES.md`, `MEMO.md`, `CHANGELOG.md`, `PRIVACY-POLICY.md`, `TERMS.md`, `CONTACT.md`, `LOOP.txt`.
