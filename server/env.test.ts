import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { validateOtpEnvironment, validateStorageEnvironment } from './env.ts';

const absoluteSqlitePath = process.platform === 'win32' ? 'C:\\can-data\\can.db' : '/var/lib/can-protection/can.db';

test('demo OTP is available only outside production and requires no vendor credentials', () => {
  const result = validateOtpEnvironment({ OTP_PROVIDER: 'demo' });
  assert.equal(result.valid, true);
  if (result.valid) {
    assert.equal(result.provider, 'demo');
    assert.equal(result.verificationMode, 'development_test');
  }
  assert.equal(validateOtpEnvironment({}).valid, true);
  assert.equal(validateOtpEnvironment({ OTP_PROVIDER: 'dev' }).valid, true);
});

test('Twilio requires its own credentials', () => {
  const missing = validateOtpEnvironment({ OTP_PROVIDER: 'twilio' });
  assert.equal(missing.valid, false);
  if (!missing.valid) assert.deepEqual(missing.missingVars, ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER']);
  const complete = validateOtpEnvironment({ OTP_PROVIDER: 'twilio', TWILIO_ACCOUNT_SID: 'AC123456', TWILIO_AUTH_TOKEN: 'token', TWILIO_FROM_NUMBER: '+15550001111' });
  assert.equal(complete.valid, true);
});

test('MSG91 requires its own credentials', () => {
  const missing = validateOtpEnvironment({ OTP_PROVIDER: 'msg91', MSG91_AUTH_KEY: 'key' });
  assert.equal(missing.valid, false);
  if (!missing.valid) assert.deepEqual(missing.missingVars, ['MSG91_TEMPLATE_ID']);
  assert.equal(validateOtpEnvironment({ OTP_PROVIDER: 'msg91', MSG91_AUTH_KEY: 'key', MSG91_TEMPLATE_ID: 'template' }).valid, true);
});

test('unknown OTP provider fails closed', () => {
  assert.equal(validateOtpEnvironment({ OTP_PROVIDER: 'custom_sms' }).valid, false);
});

test('production demo OTP is blocked even when the deprecated override is true', () => {
  for (const env of [
    { NODE_ENV: 'production', OTP_PROVIDER: 'demo' },
    { VERCEL: '1', OTP_PROVIDER: 'demo' },
    { NODE_ENV: 'production', OTP_PROVIDER: 'demo', ALLOW_DEV_OTP_DEMO: 'true' },
  ]) {
    const result = validateOtpEnvironment(env);
    assert.equal(result.valid, false);
  }
  assert.equal(validateOtpEnvironment({ NODE_ENV: 'production', OTP_PROVIDER: 'twilio', TWILIO_ACCOUNT_SID: 'AC123', TWILIO_AUTH_TOKEN: 'token', TWILIO_FROM_NUMBER: '+15550001111' }).valid, true);
});

test('local SQLite is allowed only for non-production development', () => {
  const local = validateStorageEnvironment({});
  assert.equal(local.valid, true);
  if (local.valid) assert.equal(local.backend, 'local_sqlite_dev');
  assert.equal(validateStorageEnvironment({ NODE_ENV: 'production' }).valid, false);
});

test('Supabase requires URL, secret key, and HMAC key', () => {
  const missing = validateStorageEnvironment({ SUPABASE_URL: 'https://example.supabase.co' });
  assert.equal(missing.valid, false);
  if (!missing.valid) assert.deepEqual(missing.missingVars, ['SUPABASE_SECRET_KEY', 'PHONE_LOOKUP_HMAC_KEY']);
  const valid = validateStorageEnvironment({
    SUPABASE_URL: 'https://edykghafxrrvsfbcxnkt.supabase.co',
    SUPABASE_SECRET_KEY: 'sb_secret_example_server_only_key',
    PHONE_LOOKUP_HMAC_KEY: '0123456789abcdef0123456789abcdef',
  });
  assert.equal(valid.valid, true);
  if (valid.valid) {
    assert.equal(valid.backend, 'supabase_postgres');
    assert.equal(valid.supabaseUrl, 'https://edykghafxrrvsfbcxnkt.supabase.co');
  }
});

test('production Supabase on a single-instance Node host requires explicit persistent SQLite path', () => {
  const base = {
    NODE_ENV: 'production',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SECRET_KEY: 'sb_secret_example_server_only_key',
    PHONE_LOOKUP_HMAC_KEY: '0123456789abcdef0123456789abcdef',
  };
  assert.equal(validateStorageEnvironment(base).valid, false);
  const allowed = validateStorageEnvironment({
    ...base,
    CAN_ALLOW_PRODUCTION_SQLITE: 'true',
    CAN_SQLITE_PATH: absoluteSqlitePath,
  });
  assert.equal(allowed.valid, true);
});

test('Vercel/serverless is rejected until transient state uses a shared store', () => {
  const result = validateStorageEnvironment({
    NODE_ENV: 'production',
    VERCEL: '1',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SECRET_KEY: 'sb_secret_example_server_only_key',
    PHONE_LOOKUP_HMAC_KEY: '0123456789abcdef0123456789abcdef',
    CAN_ALLOW_PRODUCTION_SQLITE: 'true',
    CAN_SQLITE_PATH: absoluteSqlitePath,
  });
  assert.equal(result.valid, false);
  if (!result.valid) assert.deepEqual(result.missingVars, ['shared_transient_store']);
});
