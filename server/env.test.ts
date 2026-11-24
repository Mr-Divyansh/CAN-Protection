import test from 'node:test';
import assert from 'node:assert/strict';
import { validateOtpEnvironment, validateStorageEnvironment } from './env.ts';

test('OTP_PROVIDER=demo requires zero Twilio or MSG91 environment variables', () => {
  const result = validateOtpEnvironment({ OTP_PROVIDER: 'demo' });
  assert.equal(result.valid, true);
  if (result.valid) {
    assert.equal(result.provider, 'demo');
    assert.equal(result.verificationMode, 'development_test');
  }
});

test('OTP_PROVIDER unset or dev defaults cleanly to demo mode without provider keys', () => {
  const unsetRes = validateOtpEnvironment({});
  assert.equal(unsetRes.valid, true);
  if (unsetRes.valid) {
    assert.equal(unsetRes.provider, 'demo');
  }

  const devRes = validateOtpEnvironment({ OTP_PROVIDER: 'dev' });
  assert.equal(devRes.valid, true);
  if (devRes.valid) {
    assert.equal(devRes.provider, 'demo');
  }
});

test('OTP_PROVIDER=demo succeeds even if partial Twilio/MSG91 variables exist or are blank', () => {
  const result = validateOtpEnvironment({
    OTP_PROVIDER: 'demo',
    TWILIO_ACCOUNT_SID: '   ',
    MSG91_AUTH_KEY: '',
  });
  assert.equal(result.valid, true);
});

test('OTP_PROVIDER=twilio requires only Twilio credentials and ignores MSG91', () => {
  const missing = validateOtpEnvironment({ OTP_PROVIDER: 'twilio' });
  assert.equal(missing.valid, false);
  if (!missing.valid) {
    assert.deepEqual(missing.missingVars, [
      'TWILIO_ACCOUNT_SID',
      'TWILIO_AUTH_TOKEN',
      'TWILIO_FROM_NUMBER',
    ]);
  }

  const complete = validateOtpEnvironment({
    OTP_PROVIDER: 'twilio',
    TWILIO_ACCOUNT_SID: 'AC123456',
    TWILIO_AUTH_TOKEN: 'secret-token',
    TWILIO_FROM_NUMBER: '+15550001111',
  });
  assert.equal(complete.valid, true);
  if (complete.valid) {
    assert.equal(complete.provider, 'twilio');
    assert.equal(complete.verificationMode, 'provider');
  }
});

test('OTP_PROVIDER=msg91 requires only MSG91 credentials and ignores Twilio', () => {
  const missing = validateOtpEnvironment({
    OTP_PROVIDER: 'msg91',
    MSG91_AUTH_KEY: 'key-123',
  });
  assert.equal(missing.valid, false);
  if (!missing.valid) {
    assert.deepEqual(missing.missingVars, ['MSG91_TEMPLATE_ID']);
  }

  const complete = validateOtpEnvironment({
    OTP_PROVIDER: 'msg91',
    MSG91_AUTH_KEY: 'key-123',
    MSG91_TEMPLATE_ID: 'tmpl-456',
  });
  assert.equal(complete.valid, true);
  if (complete.valid) {
    assert.equal(complete.provider, 'msg91');
    assert.equal(complete.verificationMode, 'provider');
  }
});

test('unknown OTP_PROVIDER fails closed', () => {
  const unknown = validateOtpEnvironment({ OTP_PROVIDER: 'custom_sms' });
  assert.equal(unknown.valid, false);
  if (!unknown.valid) {
    assert.deepEqual(unknown.missingVars, ['OTP_PROVIDER']);
  }
});

test('validateStorageEnvironment falls back to local sqlite when Supabase vars are absent', () => {
  const local = validateStorageEnvironment({});
  assert.equal(local.valid, true);
  if (local.valid) {
    assert.equal(local.backend, 'local_sqlite_dev');
  }
});

test('validateStorageEnvironment requires SUPABASE_SECRET_KEY and PHONE_LOOKUP_HMAC_KEY when Supabase is configured', () => {
  const missingSecretAndHmac = validateStorageEnvironment({
    SUPABASE_URL: 'https://edykghafxrrvsfbcxnkt.supabase.co',
  });
  assert.equal(missingSecretAndHmac.valid, false);
  if (!missingSecretAndHmac.valid) {
    assert.deepEqual(missingSecretAndHmac.missingVars, [
      'SUPABASE_SECRET_KEY',
      'PHONE_LOOKUP_HMAC_KEY',
    ]);
  }

  const missingHmac = validateStorageEnvironment({
    SUPABASE_URL: 'https://edykghafxrrvsfbcxnkt.supabase.co',
    SUPABASE_SECRET_KEY: 'sb_secret_example_server_only_key',
  });
  assert.equal(missingHmac.valid, false);
  if (!missingHmac.valid) {
    assert.deepEqual(missingHmac.missingVars, ['PHONE_LOOKUP_HMAC_KEY']);
  }

  const validSupabase = validateStorageEnvironment({
    SUPABASE_URL: 'https://edykghafxrrvsfbcxnkt.supabase.co',
    SUPABASE_SECRET_KEY: 'sb_secret_example_server_only_key',
    PHONE_LOOKUP_HMAC_KEY: '0123456789abcdef0123456789abcdef',
  });
  assert.equal(validSupabase.valid, true);
  if (validSupabase.valid) {
    assert.equal(validSupabase.backend, 'supabase_postgres');
    assert.equal(validSupabase.supabaseUrl, 'https://edykghafxrrvsfbcxnkt.supabase.co');
  }
});

test('production environment fails closed if OTP_PROVIDER is unset or demo unless ALLOW_DEV_OTP_DEMO=true', () => {
  const prodUnset = validateOtpEnvironment({ NODE_ENV: 'production' });
  assert.equal(prodUnset.valid, false);

  const prodDemo = validateOtpEnvironment({ NODE_ENV: 'production', OTP_PROVIDER: 'demo' });
  assert.equal(prodDemo.valid, false);

  const vercelDemo = validateOtpEnvironment({ VERCEL: '1', OTP_PROVIDER: 'demo' });
  assert.equal(vercelDemo.valid, false);

  const prodExplicitOverride = validateOtpEnvironment({
    NODE_ENV: 'production',
    OTP_PROVIDER: 'demo',
    ALLOW_DEV_OTP_DEMO: 'true',
  });
  assert.equal(prodExplicitOverride.valid, true);
});
