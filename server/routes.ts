import crypto from 'node:crypto';
import express, { type Request, type Response } from 'express';
import {
  evaluateChallengeVerification,
  evaluateRegistrationTransition,
  hashOtpCode,
  hashPhoneLookup,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
  SESSION_TTL_MS,
  verifyOtpHash,
} from '../src/lib/otp-policy.ts';
import { maskPhoneParts, normalizeAndValidatePhone } from '../src/lib/phone.ts';
import type { RegistrationRecordPublic, RegistrationStatusValue } from '../src/types/can.ts';
import { getDatabase, type DbPhoneRegistrationRow } from './db.ts';
import { validateStorageEnvironment } from './env.ts';
import { dispatchOtpCode, getOtpProviderConfigStatus } from './otp-provider.ts';
import {
  generateSessionToken,
  getPhoneLookupHmacKey,
  getServerPepper,
  hashSessionToken,
  requireVerifiedSession,
  type AuthenticatedRequest,
} from './session.ts';

const RATE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_OTP_REQUESTS_PER_PHONE = 4;
const MAX_OTP_REQUESTS_PER_IP = 12;
const MAX_VERIFY_ATTEMPTS_PER_IP = 25;
const MAX_MUTATIONS_PER_PHONE = 10;

function getClientIpHash(req: Request): string {
  // Express resolves req.ip using only explicitly configured trusted proxy hops.
  // Never trust a caller-supplied X-Forwarded-For value directly.
  const rawIp = req.ip || req.socket.remoteAddress || 'unknown';
  return crypto.createHmac('sha256', getServerPepper()).update(`ip:${rawIp}`).digest('hex');
}

function isValidSessionPhoneHash(phoneHash: string | undefined): phoneHash is string {
  return typeof phoneHash === 'string' && /^[0-9a-f]{64}$/i.test(phoneHash);
}

function formatRegistrationResponse(
  row: DbPhoneRegistrationRow | null,
  fallbackCountryCode: string,
  fallbackLast4: string,
  backend: 'supabase_postgres' | 'local_sqlite_dev',
  sessionVerifiedAt?: string,
): RegistrationRecordPublic {
  const status: RegistrationStatusValue = row ? row.status : 'not_registered';
  const maskedPhone = maskPhoneParts(
    row?.country_code ?? fallbackCountryCode,
    row?.phone_last4 ?? fallbackLast4,
  );
  return {
    status,
    maskedPhone,
    verifiedAt: row?.verified_at ?? sessionVerifiedAt ?? null,
    activatedAt: row?.activated_at ?? null,
    deactivatedAt: row?.deactivated_at ?? null,
    updatedAt: row?.updated_at ?? null,
    storageBackend: backend,
  };
}

export function createApiRouter() {
  const router = express.Router();

  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    next();
  });

  router.get('/health', async (_req: Request, res: Response) => {
    const provider = getOtpProviderConfigStatus();
    const storageEnv = validateStorageEnvironment(process.env);
    if (!storageEnv.valid) {
      res.status(503).json({
        ok: false,
        otpConfigured: provider.valid,
        storageConfigured: false,
        verificationMode: provider.valid ? provider.verificationMode : 'provider',
        providerName: provider.valid ? provider.providerName : 'Misconfigured',
        storageBackend: storageEnv.backend,
      });
      return;
    }

    try {
      const db = getDatabase();
      const schemaCheck = db.verifySchema ? await db.verifySchema() : { ok: true };
      if (!schemaCheck.ok && schemaCheck.error) {
        console.error(`[CAN Protection] Health schema check failed: ${schemaCheck.error}`);
      }
      res.status(schemaCheck.ok ? 200 : 503).json({
        ok: provider.valid && schemaCheck.ok,
        otpConfigured: provider.valid,
        storageConfigured: schemaCheck.ok,
        schemaVerified: schemaCheck.ok,
        verificationMode: provider.valid ? provider.verificationMode : 'provider',
        providerName: provider.valid ? provider.providerName : 'Misconfigured',
        storageBackend: db.backend,
      });
    } catch (error) {
      console.error(
        '[CAN Protection] Health check error:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      res.status(503).json({
        ok: false,
        otpConfigured: provider.valid,
        storageConfigured: false,
        schemaVerified: false,
        verificationMode: provider.valid ? provider.verificationMode : 'provider',
        providerName: provider.valid ? provider.providerName : 'Misconfigured',
        storageBackend: storageEnv.backend,
      });
    }
  });

  router.post('/otp/request', async (req: Request, res: Response) => {
    try {
      const { countryCode, phoneNumber } = req.body ?? {};
      const validation = normalizeAndValidatePhone(countryCode, phoneNumber);
      if (!validation.valid) {
        res.status(400).json({ error: validation.error });
        return;
      }

      const providerStatus = getOtpProviderConfigStatus();
      if (!providerStatus.valid) {
        res.status(503).json({
          error: providerStatus.error ?? 'OTP provider is not properly configured.',
        });
        return;
      }

      const storageEnv = validateStorageEnvironment(process.env);
      if (!storageEnv.valid) {
        res.status(503).json({ error: storageEnv.error });
        return;
      }

      const db = getDatabase();
      const pepper = getServerPepper();
      const hmacKey = getPhoneLookupHmacKey();
      const nowMs = Date.now();
      const phoneLookupHash = hashPhoneLookup(validation.e164, hmacKey);
      const ipHash = getClientIpHash(req);

      const ipLimit = await db.reserveRateLimitEvent(
        `otp_ip:${ipHash}`,
        nowMs,
        nowMs - RATE_WINDOW_MS,
        MAX_OTP_REQUESTS_PER_IP,
      );
      if (!ipLimit.allowed) {
        res.setHeader('Retry-After', String(ipLimit.retryAfterSeconds));
        res.status(429).json({
          error: `Too many verification requests from this network. Please wait ${ipLimit.retryAfterSeconds} seconds before trying again.`,
          retryAfterSeconds: ipLimit.retryAfterSeconds,
        });
        return;
      }

      const phoneLimit = await db.reserveRateLimitEvent(
        `otp_phone:${phoneLookupHash}`,
        nowMs,
        nowMs - RATE_WINDOW_MS,
        MAX_OTP_REQUESTS_PER_PHONE,
      );
      if (!phoneLimit.allowed) {
        res.setHeader('Retry-After', String(phoneLimit.retryAfterSeconds));
        res.status(429).json({
          error: `Verification limit reached for this number. Please wait ${phoneLimit.retryAfterSeconds} seconds before requesting another code.`,
          retryAfterSeconds: phoneLimit.retryAfterSeconds,
        });
        return;
      }

      const latest = await db.getLatestChallengeForPhoneHash(phoneLookupHash);
      if (latest) {
        const resendAtMs = Date.parse(latest.resend_available_at);
        if (nowMs < resendAtMs && !latest.consumed_at) {
          const waitSec = Math.ceil((resendAtMs - nowMs) / 1000);
          res.setHeader('Retry-After', String(waitSec));
          res.status(429).json({
            error: `Please wait ${waitSec} seconds before requesting a new verification code.`,
            retryAfterSeconds: waitSec,
          });
          return;
        }
      }

      const { code, dispatch } = await dispatchOtpCode(validation.e164);
      const challengeId = crypto.randomUUID();
      const otpHash = hashOtpCode(challengeId, code, pepper);
      const createdAt = new Date(nowMs).toISOString();
      const expiresAt = new Date(nowMs + OTP_TTL_MS).toISOString();
      const resendAvailableAt = new Date(nowMs + OTP_RESEND_COOLDOWN_MS).toISOString();

      await db.createOtpChallenge({
        id: challengeId,
        phoneHash: phoneLookupHash,
        phoneLast4: validation.last4,
        countryCode: validation.countryCode,
        otpHash,
        maxAttempts: OTP_MAX_ATTEMPTS,
        expiresAt,
        resendAvailableAt,
        createdAt,
      });


      // Never disclose registration status prior to ownership verification.
      res.status(201).json({
        challengeId,
        maskedPhone: validation.masked,
        expiresInSeconds: Math.floor(OTP_TTL_MS / 1000),
        resendCooldownSeconds: Math.floor(OTP_RESEND_COOLDOWN_MS / 1000),
        maxAttempts: OTP_MAX_ATTEMPTS,
        verificationMode: dispatch.verificationMode,
        providerName: dispatch.providerName,
        ...(dispatch.devTestCode ? { devTestCode: dispatch.devTestCode } : {}),
      });
    } catch (error) {
      const message =
        error instanceof Error && error.message.includes('not configured')
          ? error.message
          : 'Unable to initiate mobile number verification right now. Please try again shortly.';
      const status = error instanceof Error && error.message.includes('not configured') ? 503 : 500;
      res.status(status).json({ error: message });
    }
  });

  router.post('/otp/verify', async (req: Request, res: Response) => {
    try {
      const { challengeId, code } = req.body ?? {};
      if (
        typeof challengeId !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(challengeId.trim())
      ) {
        res.status(400).json({ error: 'Invalid verification challenge reference.' });
        return;
      }

      if (typeof code !== 'string') {
        res.status(400).json({ error: 'Please enter the 6-digit verification code.' });
        return;
      }

      const storageEnv = validateStorageEnvironment(process.env);
      if (!storageEnv.valid) {
        res.status(503).json({ error: storageEnv.error });
        return;
      }

      const db = getDatabase();
      const nowMs = Date.now();
      const ipHash = getClientIpHash(req);
      const ipLimit = await db.reserveRateLimitEvent(
        `verify_ip:${ipHash}`,
        nowMs,
        nowMs - RATE_WINDOW_MS,
        MAX_VERIFY_ATTEMPTS_PER_IP,
      );
      if (!ipLimit.allowed) {
        res.setHeader('Retry-After', String(ipLimit.retryAfterSeconds));
        res.status(429).json({
          error: `Too many verification attempts. Please wait ${ipLimit.retryAfterSeconds} seconds.`,
          retryAfterSeconds: ipLimit.retryAfterSeconds,
        });
        return;
      }


      const challenge = await db.getOtpChallengeById(challengeId.trim());
      if (!challenge) {
        res.status(404).json({ error: 'Verification challenge not found or expired.' });
        return;
      }

      const trimmedCode = code.trim();
      const isFormatValid = /^\d{6}$/.test(trimmedCode);
      const isMatch = isFormatValid
        ? verifyOtpHash(challenge.id, trimmedCode, challenge.otp_hash, getServerPepper())
        : false;

      const evaluation = evaluateChallengeVerification({
        nowMs,
        expiresAtMs: Date.parse(challenge.expires_at),
        consumedAtMs: challenge.consumed_at ? Date.parse(challenge.consumed_at) : null,
        attempts: challenge.attempts,
        maxAttempts: challenge.max_attempts,
        submittedCode: trimmedCode,
        isMatch,
      });

      switch (evaluation.outcome) {
        case 'already_used':
          res.status(409).json({
            error: 'This verification code has already been used. Request a new code if needed.',
          });
          return;
        case 'expired':
          res.status(410).json({
            error: 'This verification code has expired. Please request a new code.',
          });
          return;
        case 'locked':
          res.status(429).json({
            error: 'Maximum verification attempts exceeded. Please request a new verification code.',
          });
          return;
        case 'invalid_format':
          res.status(400).json({
            error: 'Enter a valid 6-digit numeric verification code.',
          });
          return;
        case 'invalid_code':
          const attempts = await db.incrementOtpAttempts(challenge.id, challenge.max_attempts);
          if (attempts === null) {
            res.status(429).json({
              error: 'Maximum verification attempts exceeded. Please request a new verification code.',
            });
            return;
          }
          const remainingAttempts = Math.max(0, challenge.max_attempts - attempts);
          res.status(400).json({
            error:
              remainingAttempts > 0
                ? `Incorrect verification code. ${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining.`
                : 'Incorrect verification code. Maximum attempts reached; please request a new code.',
            remainingAttempts,
          });
          return;
        case 'verified': {
          const provider = getOtpProviderConfigStatus();
          if (!provider.valid) {
            res.status(503).json({
              error: provider.error ?? 'OTP provider is not properly configured.',
            });
            return;
          }

          const nowIso = new Date(nowMs).toISOString();
          const consumed = await db.consumeOtpChallenge(challenge.id, nowIso);
          if (!consumed) {
            res.status(409).json({
              error: 'This verification code has already been used. Request a new code if needed.',
            });
            return;
          }

          const { rawToken, tokenHash } = generateSessionToken();
          const sessionExpiresAt = new Date(nowMs + SESSION_TTL_MS).toISOString();

          await db.createVerifiedSession({
            id: crypto.randomUUID(),
            tokenHash,
            phoneHash: challenge.phone_hash,
            phoneLast4: challenge.phone_last4,
            countryCode: challenge.country_code,
            verificationMode: provider.verificationMode,
            expiresAt: sessionExpiresAt,
            createdAt: nowIso,
          });

          res.json({
            sessionToken: rawToken,
            expiresAt: sessionExpiresAt,
            maskedPhone: maskPhoneParts(challenge.country_code, challenge.phone_last4),
            verificationMode: provider.verificationMode,
          });
          return;
        }
      }
    } catch {
      res.status(500).json({ error: 'Unable to verify code right now. Please try again.' });
    }
  });

  router.post(
    '/session/logout',
    requireVerifiedSession,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const authHeader = req.headers.authorization!;
        const rawToken = authHeader.slice('Bearer '.length).trim();
        const db = getDatabase();
        await db.revokeSessionByTokenHash(hashSessionToken(rawToken), new Date().toISOString());
        res.json({ ok: true });
      } catch {
        res.status(500).json({ error: 'Unable to close session.' });
      }
    },
  );

  router.get(
    '/registration/status',
    requireVerifiedSession,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const session = req.verifiedSession!;
        if (!isValidSessionPhoneHash(session.phone_hash)) {
          res.status(401).json({
            error: 'Verification session ownership could not be confirmed. Please verify again.',
          });
          return;
        }

        const db = getDatabase();
        const row = await db.getRegistrationByPhoneHash(session.phone_hash);
        if (row && row.phone_number_hash !== session.phone_hash) {
          res.status(403).json({ error: 'Ownership verification mismatch.' });
          return;
        }

        res.json(
          formatRegistrationResponse(
            row,
            session.country_code,
            session.phone_last4,
            db.backend,
            session.created_at,
          ),
        );
      } catch {
        res.status(500).json({ error: 'Unable to retrieve registration status.' });
      }
    },
  );

  router.post(
    '/registration/activate',
    requireVerifiedSession,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const session = req.verifiedSession!;
        if (!isValidSessionPhoneHash(session.phone_hash)) {
          res.status(401).json({
            error: 'Verification session ownership could not be confirmed. Please verify again.',
          });
          return;
        }

        const db = getDatabase();
        const nowMs = Date.now();
        const rateLimit = await db.reserveRateLimitEvent(
          `mut:${session.phone_hash}`,
          nowMs,
          nowMs - RATE_WINDOW_MS,
          MAX_MUTATIONS_PER_PHONE,
        );
        if (!rateLimit.allowed) {
          res.setHeader('Retry-After', String(rateLimit.retryAfterSeconds));
          res.status(429).json({
            error: `Too many status changes. Please wait ${rateLimit.retryAfterSeconds} seconds.`,
          });
          return;
        }

        const existing = await db.getRegistrationByPhoneHash(session.phone_hash);
        if (existing && existing.phone_number_hash !== session.phone_hash) {
          res.status(403).json({ error: 'Ownership verification mismatch.' });
          return;
        }

        const currentStatus: RegistrationStatusValue = existing ? existing.status : 'not_registered';
        const transition = evaluateRegistrationTransition(currentStatus, 'activate', true);
        if (!transition.allowed) {
          res.status(400).json({ error: transition.reason });
          return;
        }

        const nowIso = new Date(nowMs).toISOString();
        const updated = await db.upsertActivateRegistration({
          phoneNumberHash: session.phone_hash,
          phoneLast4: session.phone_last4,
          countryCode: session.country_code,
          verifiedAt: session.created_at,
          nowIso,
        });
        res.json(
          formatRegistrationResponse(
            updated,
            session.country_code,
            session.phone_last4,
            db.backend,
          ),
        );
      } catch {
        res.status(500).json({ error: 'Unable to activate protection registration.' });
      }
    },
  );

  router.post(
    '/registration/deactivate',
    requireVerifiedSession,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const session = req.verifiedSession!;
        if (!isValidSessionPhoneHash(session.phone_hash)) {
          res.status(401).json({
            error: 'Verification session ownership could not be confirmed. Please verify again.',
          });
          return;
        }

        const confirmed = req.body?.confirm === true;
        const db = getDatabase();
        const nowMs = Date.now();

        const rateLimit = await db.reserveRateLimitEvent(
          `mut:${session.phone_hash}`,
          nowMs,
          nowMs - RATE_WINDOW_MS,
          MAX_MUTATIONS_PER_PHONE,
        );
        if (!rateLimit.allowed) {
          res.setHeader('Retry-After', String(rateLimit.retryAfterSeconds));
          res.status(429).json({
            error: `Too many status changes. Please wait ${rateLimit.retryAfterSeconds} seconds.`,
          });
          return;
        }

        const existing = await db.getRegistrationByPhoneHash(session.phone_hash);
        if (existing && existing.phone_number_hash !== session.phone_hash) {
          res.status(403).json({ error: 'Ownership verification mismatch.' });
          return;
        }

        const currentStatus: RegistrationStatusValue = existing ? existing.status : 'not_registered';
        const transition = evaluateRegistrationTransition(currentStatus, 'deactivate', confirmed);
        if (!transition.allowed) {
          res.status(400).json({ error: transition.reason });
          return;
        }

        const nowIso = new Date(nowMs).toISOString();
        const updated = await db.deactivateRegistration({
          phoneNumberHash: session.phone_hash,
          nowIso,
        });
        res.json(
          formatRegistrationResponse(
            updated,
            session.country_code,
            session.phone_last4,
            db.backend,
          ),
        );
      } catch {
        res.status(500).json({ error: 'Unable to deactivate protection registration.' });
      }
    },
  );

  router.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  return router;
}
