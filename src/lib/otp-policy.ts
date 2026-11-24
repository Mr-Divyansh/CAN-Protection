import crypto from 'node:crypto';
import type { RegistrationStatusValue } from '../types/can.ts';

export const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const OTP_RESEND_COOLDOWN_MS = 30 * 1000; // 30 seconds
export const OTP_MAX_ATTEMPTS = 5;
export const SESSION_TTL_MS = 15 * 60 * 1000; // 15 minutes

export function hashOtpCode(challengeId: string, code: string, pepper: string): string {
  return crypto
    .createHmac('sha256', pepper)
    .update(`otp:${challengeId}:${code}`)
    .digest('hex');
}

export function verifyOtpHash(
  challengeId: string,
  submittedCode: string,
  expectedHash: string,
  pepper: string,
): boolean {
  const computed = hashOtpCode(challengeId, submittedCode, pepper);
  const a = Buffer.from(computed, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

export function hashPhoneIdentifier(e164: string, pepper: string): string {
  return crypto.createHmac('sha256', pepper).update(`phone:${e164}`).digest('hex');
}

export function hashPhoneLookup(e164: string, hmacKey: string): string {
  if (!e164.startsWith('+')) {
    throw new Error('Phone number must be normalized to E.164 before hashing.');
  }
  return crypto.createHmac('sha256', hmacKey).update(e164).digest('hex');
}

export type ChallengeEvalInput = {
  nowMs: number;
  expiresAtMs: number;
  consumedAtMs: number | null;
  attempts: number;
  maxAttempts: number;
  submittedCode: string;
  isMatch: boolean;
};

export type ChallengeEvalResult =
  | { outcome: 'verified' }
  | { outcome: 'already_used' }
  | { outcome: 'expired' }
  | { outcome: 'locked' }
  | { outcome: 'invalid_format' }
  | { outcome: 'invalid_code'; remainingAttempts: number };

export function evaluateChallengeVerification(input: ChallengeEvalInput): ChallengeEvalResult {
  if (input.consumedAtMs !== null) {
    return { outcome: 'already_used' };
  }
  if (input.nowMs > input.expiresAtMs) {
    return { outcome: 'expired' };
  }
  if (input.attempts >= input.maxAttempts) {
    return { outcome: 'locked' };
  }
  if (!/^\d{6}$/.test(input.submittedCode.trim())) {
    return { outcome: 'invalid_format' };
  }
  if (!input.isMatch) {
    const nextAttempts = input.attempts + 1;
    return {
      outcome: 'invalid_code',
      remainingAttempts: Math.max(0, input.maxAttempts - nextAttempts),
    };
  }
  return { outcome: 'verified' };
}

export function evaluateRateLimit(
  timestampsMs: number[],
  nowMs: number,
  windowMs: number,
  maxRequests: number,
): { allowed: boolean; retryAfterSeconds: number; remaining: number } {
  const windowStart = nowMs - windowMs;
  const active = timestampsMs.filter((ts) => ts > windowStart).sort((a, b) => a - b);

  if (active.length >= maxRequests) {
    const oldest = active[0];
    const retryAfterMs = Math.max(1000, oldest + windowMs - nowMs);
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
      remaining: 0,
    };
  }

  return {
    allowed: true,
    retryAfterSeconds: 0,
    remaining: Math.max(0, maxRequests - active.length),
  };
}

export type TransitionResult =
  | { allowed: true; nextStatus: 'active' | 'inactive'; alreadyInTargetState: boolean }
  | { allowed: false; reason: string };

export function evaluateRegistrationTransition(
  currentStatus: RegistrationStatusValue,
  action: 'activate' | 'deactivate',
  confirmed: boolean,
): TransitionResult {
  if (action === 'activate') {
    if (currentStatus === 'active') {
      return { allowed: true, nextStatus: 'active', alreadyInTargetState: true };
    }
    return { allowed: true, nextStatus: 'active', alreadyInTargetState: false };
  }

  if (!confirmed) {
    return {
      allowed: false,
      reason: 'Explicit confirmation is required before deactivating CAN Protection.',
    };
  }

  if (currentStatus === 'not_registered') {
    return {
      allowed: false,
      reason: 'This number does not have an active registration to deactivate.',
    };
  }

  if (currentStatus === 'inactive') {
    return { allowed: true, nextStatus: 'inactive', alreadyInTargetState: true };
  }

  return { allowed: true, nextStatus: 'inactive', alreadyInTargetState: false };
}
