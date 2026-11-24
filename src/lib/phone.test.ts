import test from 'node:test';
import assert from 'node:assert/strict';
import { maskNormalizedPhone, maskPhoneParts, normalizeAndValidatePhone } from './phone.ts';

test('normalizes valid +91 mobile number with formatting spaces', () => {
  const result = normalizeAndValidatePhone('+91', '98765 43210');
  assert.equal(result.valid, true);
  if (result.valid) {
    assert.equal(result.e164, '+919876543210');
    assert.equal(result.nationalNumber, '9876543210');
    assert.equal(result.last4, '3210');
    assert.equal(result.masked, '+91 ••••••3210');
  }
});

test('strips leading zero or repeated +91 prefix cleanly', () => {
  const leadingZero = normalizeAndValidatePhone('+91', '09876543210');
  assert.equal(leadingZero.valid, true);
  if (leadingZero.valid) {
    assert.equal(leadingZero.e164, '+919876543210');
  }

  const withPrefix = normalizeAndValidatePhone('+91', '+91 98765-43210');
  assert.equal(withPrefix.valid, true);
  if (withPrefix.valid) {
    assert.equal(withPrefix.e164, '+919876543210');
  }
});

test('rejects invalid +91 starting digits and alphabetic input', () => {
  const badStart = normalizeAndValidatePhone('+91', '1234567890');
  assert.equal(badStart.valid, false);

  const alpha = normalizeAndValidatePhone('+91', '98765abc10');
  assert.equal(alpha.valid, false);

  const shortNum = normalizeAndValidatePhone('+91', '98765');
  assert.equal(shortNum.valid, false);
});

test('validates non-India supported country codes', () => {
  const us = normalizeAndValidatePhone('+1', '(415) 555-0199');
  assert.equal(us.valid, true);
  if (us.valid) {
    assert.equal(us.e164, '+14155550199');
    assert.equal(us.masked, '+1 ••••••0199');
  }

  const unsupported = normalizeAndValidatePhone('+999', '1234567890');
  assert.equal(unsupported.valid, false);
});

test('maskNormalizedPhone and maskPhoneParts hide sensitive digits', () => {
  assert.equal(maskNormalizedPhone('+919812345678'), '+91 ••••••5678');
  assert.equal(maskNormalizedPhone('+6581234567'), '+65 ••••4567');
  assert.equal(maskPhoneParts('+91', '5678'), '+91 ••••••5678');
  assert.equal(maskPhoneParts('+65', '4567'), '+65 ••••4567');
});
