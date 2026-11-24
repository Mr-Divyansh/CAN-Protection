import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateChallengeVerification,
  evaluateRateLimit,
  evaluateRegistrationTransition,
  hashOtpCode,
  hashPhoneIdentifier,
  hashPhoneLookup,
  verifyOtpHash,
} from './otp-policy.ts';

const TEST_PEPPER = 'unit-test-pepper-secret';

test('hashOtpCode produces non-plaintext HMAC and verifies securely', () => {
  const challengeId = 'chal-123';
  const hash = hashOtpCode(challengeId, '482910', TEST_PEPPER);
  assert.equal(hash.includes('482910'), false);
  assert.equal(hash.length, 64);
  assert.equal(verifyOtpHash(challengeId, '482910', hash, TEST_PEPPER), true);
  assert.equal(verifyOtpHash(challengeId, '000000', hash, TEST_PEPPER), false);
});

test('hashPhoneIdentifier and hashPhoneLookup produce deterministic HMAC without raw digits', () => {
  const h1 = hashPhoneIdentifier('+919876543210', TEST_PEPPER);
  const h2 = hashPhoneIdentifier('+919876543210', TEST_PEPPER);
  assert.equal(h1, h2);
  assert.equal(h1.includes('9876543210'), false);

  const l1 = hashPhoneLookup('+919876543210', TEST_PEPPER);
  const l2 = hashPhoneLookup('+919876543210', TEST_PEPPER);
  assert.equal(l1, l2);
  assert.equal(l1.length, 64);
  assert.equal(l1.includes('9876543210'), false);
  assert.throws(() => hashPhoneLookup('9876543210', TEST_PEPPER));
});

test('evaluateChallengeVerification blocks replay, expiry, and brute force', () => {
  const base = {
    nowMs: 1000,
    expiresAtMs: 5000,
    consumedAtMs: null,
    attempts: 0,
    maxAttempts: 5,
    submittedCode: '123456',
    isMatch: true,
  };

  assert.equal(evaluateChallengeVerification(base).outcome, 'verified');
  assert.equal(
    evaluateChallengeVerification({ ...base, consumedAtMs: 900 }).outcome,
    'already_used',
  );
  assert.equal(evaluateChallengeVerification({ ...base, nowMs: 6000 }).outcome, 'expired');
  assert.equal(evaluateChallengeVerification({ ...base, attempts: 5 }).outcome, 'locked');
  assert.equal(
    evaluateChallengeVerification({ ...base, submittedCode: '12ab' }).outcome,
    'invalid_format',
  );

  const wrong = evaluateChallengeVerification({ ...base, attempts: 2, isMatch: false });
  assert.equal(wrong.outcome, 'invalid_code');
  if (wrong.outcome === 'invalid_code') {
    assert.equal(wrong.remainingAttempts, 2);
  }
});

test('evaluateRateLimit enforces sliding window limits', () => {
  const windowMs = 60_000;
  const now = 100_000;
  const under = evaluateRateLimit([60_000, 80_000], now, windowMs, 3);
  assert.equal(under.allowed, true);
  assert.equal(under.remaining, 1);

  const over = evaluateRateLimit([50_000, 70_000, 90_000], now, windowMs, 3);
  assert.equal(over.allowed, false);
  assert.equal(over.retryAfterSeconds, 10);
});

test('evaluateRegistrationTransition prevents duplicate active and requires confirmation', () => {
  const actNew = evaluateRegistrationTransition('not_registered', 'activate', false);
  assert.deepEqual(actNew, { allowed: true, nextStatus: 'active', alreadyInTargetState: false });

  const actDup = evaluateRegistrationTransition('active', 'activate', false);
  assert.deepEqual(actDup, { allowed: true, nextStatus: 'active', alreadyInTargetState: true });

  const deactNoConfirm = evaluateRegistrationTransition('active', 'deactivate', false);
  assert.equal(deactNoConfirm.allowed, false);

  const deactConfirm = evaluateRegistrationTransition('active', 'deactivate', true);
  assert.deepEqual(deactConfirm, {
    allowed: true,
    nextStatus: 'inactive',
    alreadyInTargetState: false,
  });
});
