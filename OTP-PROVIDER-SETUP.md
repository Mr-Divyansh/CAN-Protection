# CAN Protection — OTP Provider Setup Guide

## Current State
The codebase ships with two built-in real SMS provider adapters (`twilio` and `msg91`) and a clearly labelled **Demo / Development Test Mode** (`OTP_PROVIDER=demo`, or `dev` / blank in non-production environments).

When `OTP_PROVIDER=demo` is selected in development, **all Twilio and MSG91 environment variables are optional** and do not need to be configured. Provider-specific credentials are validated and required only when `OTP_PROVIDER=twilio` or `OTP_PROVIDER=msg91` is selected.

## Option A: Demo / Development Test Mode (No External Credentials Required)
1. Set `OTP_PROVIDER=demo` (or leave `OTP_PROVIDER` unset when `NODE_ENV !== 'production'` and `VERCEL !== '1'`).
2. Leave all `TWILIO_*` and `MSG91_*` environment variables blank or omitted.
3. All authentication and security controls (HMAC-SHA256 OTP hashing, 5-minute TTL, max 5 attempts, atomic single-use replay prevention, rate limits, short-lived Bearer sessions, and confirmed deactivation) remain fully active.

## Option B: MSG91 (Recommended for India `+91` DLT Compliance)
1. Register your entity, header (Sender ID), and OTP SMS template on a TRAI DLT portal (required by Indian telecom regulations before commercial/OTP SMS delivery in India).
2. Create an MSG91 account, link your DLT Entity ID and Template ID, and obtain `MSG91_AUTH_KEY` and `MSG91_TEMPLATE_ID`.
3. Set `OTP_PROVIDER=msg91`, `MSG91_AUTH_KEY`, and `MSG91_TEMPLATE_ID` in server environment variables. Twilio variables remain optional.
4. **Cost Note**: SMS OTP delivery is a paid per-message telecom service; check current MSG91 India DLT & per-SMS pricing before enabling.

## Option C: Twilio Programmable SMS
1. Create a Twilio account and purchase/verify a sender number (note India DLT requirements for `+91` traffic).
2. Set `OTP_PROVIDER=twilio`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM_NUMBER` in server environment variables. MSG91 variables remain optional.
3. **Cost Note**: Twilio charges per outbound SMS segment plus monthly phone number rental.

## Production Safety Rule (Fail Closed)
In production (`NODE_ENV=production` or `VERCEL=1`), leaving `OTP_PROVIDER` unset or set to `demo` **fails closed (`503`)** so simulated demo codes are never served accidentally to live users.

- Set `OTP_PROVIDER=twilio` or `OTP_PROVIDER=msg91` with valid credentials for production launches.
- Only if you intentionally deploy a controlled staging preview in production mode, set `ALLOW_DEV_OTP_DEMO=true` alongside `OTP_PROVIDER=demo`.
- If `twilio` or `msg91` is missing required keys, or an unknown `OTP_PROVIDER` value is provided, the server always fails closed (`503`).
