# CAN Protection — Deployment Notes

## Target
Use a free-tier deployment for development/demo where provider terms and usage limits permit.

## Proposed services
- GitHub: source repository.
- Vercel: Next.js hosting.
- Supabase: PostgreSQL.
- OTP provider: decide after reviewing India support, compliance, and cost.

## Before deployment
- Configure environment variables in the hosting dashboard.
- Never commit `.env.local` or secrets.
- Configure production database policies.
- Configure allowed origins and redirect URLs where applicable.
- Verify HTTPS.
- Confirm OTP provider settings and rate limits.
- Test production activation/deactivation and error handling.
- Publish accurate Privacy Policy and Terms.

## Cost note
SMS/OTP delivery may incur charges. Free hosting and database tiers have limits and can change. Do not promise the entire production service is free.
