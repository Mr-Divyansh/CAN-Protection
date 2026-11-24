import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { getDatabase, type DbSessionRow } from './db.ts';
import { hasRealEnvValue, isProductionEnvironment, validateStorageEnvironment } from './env.ts';

const EPHEMERAL_FALLBACK_SECRET = crypto.randomBytes(32).toString('hex');
const EPHEMERAL_FALLBACK_PHONE_HMAC = crypto.randomBytes(32).toString('hex');

export function getServerPepper(): string {
  const configured = process.env.CAN_SERVER_SECRET?.trim();
  if (configured && configured.length >= 32 && !configured.startsWith('MY_')) {
    return configured;
  }
  if (isProductionEnvironment()) {
    throw new Error('CAN_SERVER_SECRET must be a persistent random secret of at least 32 characters in production.');
  }
  return EPHEMERAL_FALLBACK_SECRET;
}

export function getPhoneLookupHmacKey(): string {
  if (hasRealEnvValue(process.env.PHONE_LOOKUP_HMAC_KEY)) {
    const key = process.env.PHONE_LOOKUP_HMAC_KEY!.trim();
    if (key.length < 32) {
      throw new Error('PHONE_LOOKUP_HMAC_KEY must be at least 32 characters.');
    }
    return key;
  }

  const storageStatus = validateStorageEnvironment(process.env);
  if (storageStatus.backend === 'supabase_postgres') {
    throw new Error('PHONE_LOOKUP_HMAC_KEY is required when Supabase storage is configured.');
  }

  return EPHEMERAL_FALLBACK_PHONE_HMAC;
}

export function generateSessionToken(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashSessionToken(rawToken);
  return { rawToken, tokenHash };
}

export function hashSessionToken(rawToken: string): string {
  return crypto
    .createHmac('sha256', getServerPepper())
    .update(`session:${rawToken}`)
    .digest('hex');
}

export interface AuthenticatedRequest extends Request {
  verifiedSession?: DbSessionRow;
}

export async function requireVerifiedSession(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const storageEnv = validateStorageEnvironment(process.env);
    if (!storageEnv.valid) {
      res.status(503).json({ error: storageEnv.error });
      return;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Ownership verification is required before viewing or managing registration status.',
      });
      return;
    }

    const rawToken = authHeader.slice('Bearer '.length).trim();
    if (!rawToken || rawToken.length < 20) {
      res.status(401).json({ error: 'Invalid verification session token.' });
      return;
    }

    const tokenHash = hashSessionToken(rawToken);
    const db = getDatabase();
    const session = await db.getSessionByTokenHash(tokenHash);

    if (!session) {
      res.status(401).json({
        error: 'Verification session not found or expired. Please verify your number again.',
      });
      return;
    }

    if (session.revoked_at) {
      res.status(401).json({
        error: 'This verification session has been closed. Please verify your number again.',
      });
      return;
    }

    if (Date.now() > Date.parse(session.expires_at)) {
      res.status(401).json({
        error: 'Your verification session has expired. Please verify your mobile number again.',
      });
      return;
    }

    req.verifiedSession = session;
    next();
  } catch {
    res.status(500).json({ error: 'Unable to validate verification session.' });
  }
}
