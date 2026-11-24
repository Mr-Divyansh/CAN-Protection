import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { resetDatabaseCacheForTests } from './db.ts';
import { createApiRouter } from './routes.ts';

function startTestServer(): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const app = express();
  app.use(express.json());
  app.use('/api', createApiRouter());

  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        throw new Error('Unexpected server address');
      }
      resolve({
        baseUrl: `http://127.0.0.1:${addr.port}`,
        close: () =>
          new Promise<void>((res, rej) => server.close((err) => (err ? rej(err) : res()))),
      });
    });
  });
}

test('full OTP verification, security boundaries, anti-enumeration, zero raw phone storage, and registration lifecycle', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'can-routes-test-'));
  const sqliteFile = path.join(tmpDir, 'routes.db');
  const prevSqlitePath = process.env.CAN_SQLITE_PATH;
  const prevHmacKey = process.env.PHONE_LOOKUP_HMAC_KEY;

  process.env.CAN_SQLITE_PATH = sqliteFile;
  process.env.PHONE_LOOKUP_HMAC_KEY = 'test-only-hmac-key-at-least-32-chars!!';
  resetDatabaseCacheForTests();

  const srv = await startTestServer();
  try {
    // 1. Unauthorized access must be denied
    const unauthStatus = await fetch(`${srv.baseUrl}/api/registration/status`);
    assert.equal(unauthStatus.status, 401);

    const unauthActivate = await fetch(`${srv.baseUrl}/api/registration/activate`, {
      method: 'POST',
    });
    assert.equal(unauthActivate.status, 401);

    const unauthDeactivate = await fetch(`${srv.baseUrl}/api/registration/deactivate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: true }),
    });
    assert.equal(unauthDeactivate.status, 401);

    // 2. Invalid phone number must fail validation
    const invalidPhone = await fetch(`${srv.baseUrl}/api/otp/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ countryCode: '+91', phoneNumber: '12345' }),
    });
    assert.equal(invalidPhone.status, 400);

    // 3. Valid phone number initiates challenge (use unique suffix per test run)
    const uniqueSuffix = String(Math.floor(1000 + Math.random() * 8999));
    const testPhone = `987654${uniqueSuffix}`;
    const testE164 = `+91${testPhone}`;
    const otpReq = await fetch(`${srv.baseUrl}/api/otp/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ countryCode: '+91', phoneNumber: testPhone }),
    });
    assert.equal(otpReq.status, 201);
    const reqBody = (await otpReq.json()) as {
      challengeId: string;
      maskedPhone: string;
      verificationMode: string;
      devTestCode?: string;
    };
    assert.ok(reqBody.challengeId);
    assert.equal(reqBody.maskedPhone, `+91 ••••••${uniqueSuffix}`);
    assert.equal(reqBody.verificationMode, 'development_test');
    assert.match(reqBody.devTestCode ?? '', /^\d{6}$/);
    // Anti-enumeration: status must never be exposed in /api/otp/request response
    assert.equal('status' in reqBody, false);

    // 4. Rapid resend must trigger 429 cooldown
    const rapidResend = await fetch(`${srv.baseUrl}/api/otp/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ countryCode: '+91', phoneNumber: testPhone }),
    });
    assert.equal(rapidResend.status, 429);

    // 5. Wrong OTP code decrements attempts
    const wrongOtp = await fetch(`${srv.baseUrl}/api/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId: reqBody.challengeId, code: '000000' }),
    });
    if (reqBody.devTestCode !== '000000') {
      assert.equal(wrongOtp.status, 400);
    }

    // 6. Correct OTP issues verified session
    const verifyRes = await fetch(`${srv.baseUrl}/api/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challengeId: reqBody.challengeId,
        code: reqBody.devTestCode,
      }),
    });
    assert.equal(verifyRes.status, 200);
    const sessionBody = (await verifyRes.json()) as { sessionToken: string; maskedPhone: string };
    assert.ok(sessionBody.sessionToken);
    assert.equal(sessionBody.maskedPhone, `+91 ••••••${uniqueSuffix}`);

    // 7. Replaying same OTP must be rejected
    const replayRes = await fetch(`${srv.baseUrl}/api/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challengeId: reqBody.challengeId,
        code: reqBody.devTestCode,
      }),
    });
    assert.equal(replayRes.status, 409);

    const authHeaders = {
      Authorization: `Bearer ${sessionBody.sessionToken}`,
      'Content-Type': 'application/json',
    };

    // 8. Check initial registration status -> not_registered
    const initialStatus = await fetch(`${srv.baseUrl}/api/registration/status`, {
      headers: authHeaders,
    });
    assert.equal(initialStatus.status, 200);
    const initialData = (await initialStatus.json()) as { status: string; maskedPhone: string };
    assert.equal(initialData.status, 'not_registered');
    assert.equal(initialData.maskedPhone, `+91 ••••••${uniqueSuffix}`);

    // 9. Activate protection
    const activateRes = await fetch(`${srv.baseUrl}/api/registration/activate`, {
      method: 'POST',
      headers: authHeaders,
    });
    assert.equal(activateRes.status, 200);
    const activatedData = (await activateRes.json()) as {
      status: string;
      activatedAt: string | null;
      updatedAt: string | null;
    };
    assert.equal(activatedData.status, 'active');
    assert.ok(activatedData.activatedAt);
    assert.ok(activatedData.updatedAt);

    // 10. Repeated activate remains single active record and updates updatedAt cleanly
    await new Promise((r) => setTimeout(r, 15));
    const reactivateActiveRes = await fetch(`${srv.baseUrl}/api/registration/activate`, {
      method: 'POST',
      headers: authHeaders,
    });
    assert.equal(reactivateActiveRes.status, 200);
    const reactivatedActiveData = (await reactivateActiveRes.json()) as {
      status: string;
      activatedAt: string | null;
      updatedAt: string | null;
    };
    assert.equal(reactivatedActiveData.status, 'active');
    assert.equal(reactivatedActiveData.activatedAt, activatedData.activatedAt);
    assert.notEqual(reactivatedActiveData.updatedAt, activatedData.updatedAt);

    // 11. Deactivate without confirmation must fail
    const deactUnconfirmed = await fetch(`${srv.baseUrl}/api/registration/deactivate`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ confirm: false }),
    });
    assert.equal(deactUnconfirmed.status, 400);

    // 12. Deactivate with confirmation succeeds
    const deactConfirmed = await fetch(`${srv.baseUrl}/api/registration/deactivate`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ confirm: true }),
    });
    assert.equal(deactConfirmed.status, 200);
    const deactivatedData = (await deactConfirmed.json()) as {
      status: string;
      deactivatedAt: string | null;
      updatedAt: string | null;
    };
    assert.equal(deactivatedData.status, 'inactive');
    assert.ok(deactivatedData.deactivatedAt);
    assert.ok(deactivatedData.updatedAt);

    // 13. Confirm DB contains ZERO raw phone numbers in any table
    const inspected = new DatabaseSync(sqliteFile);
    for (const table of ['phone_registrations', 'otp_challenges', 'verified_sessions', 'rate_limit_events']) {
      const allRows = inspected.prepare(`SELECT * FROM ${table}`).all();
      const serialized = JSON.stringify(allRows);
      assert.equal(serialized.includes(testPhone), false, `${table} leaked raw phone number`);
      assert.equal(serialized.includes(testE164), false, `${table} leaked E.164 phone number`);
    }
    const regCount = inspected.prepare('SELECT COUNT(*) as cnt FROM phone_registrations').get() as {
      cnt: number;
    };
    assert.equal(regCount.cnt, 1);
    inspected.close();

    // 14. Logout revokes session
    const logoutRes = await fetch(`${srv.baseUrl}/api/session/logout`, {
      method: 'POST',
      headers: authHeaders,
    });
    assert.equal(logoutRes.status, 200);

    const afterLogout = await fetch(`${srv.baseUrl}/api/registration/status`, {
      headers: authHeaders,
    });
    assert.equal(afterLogout.status, 401);
  } finally {
    await srv.close();
    resetDatabaseCacheForTests();
    if (prevSqlitePath === undefined) delete process.env.CAN_SQLITE_PATH;
    else process.env.CAN_SQLITE_PATH = prevSqlitePath;
    if (prevHmacKey === undefined) delete process.env.PHONE_LOOKUP_HMAC_KEY;
    else process.env.PHONE_LOOKUP_HMAC_KEY = prevHmacKey;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('OTP_PROVIDER=demo requires no Twilio/MSG91 vars while misconfigured real provider or Supabase env fails closed', async () => {
  const prevProvider = process.env.OTP_PROVIDER;
  const prevSid = process.env.TWILIO_ACCOUNT_SID;
  const prevToken = process.env.TWILIO_AUTH_TOKEN;
  const prevFrom = process.env.TWILIO_FROM_NUMBER;
  const prevMsg91Key = process.env.MSG91_AUTH_KEY;
  const prevMsg91Tpl = process.env.MSG91_TEMPLATE_ID;
  const prevSupabaseUrl = process.env.SUPABASE_URL;
  const prevSupabaseSecret = process.env.SUPABASE_SECRET_KEY;
  const prevHmacKey = process.env.PHONE_LOOKUP_HMAC_KEY;

  delete process.env.TWILIO_ACCOUNT_SID;
  delete process.env.TWILIO_AUTH_TOKEN;
  delete process.env.TWILIO_FROM_NUMBER;
  delete process.env.MSG91_AUTH_KEY;
  delete process.env.MSG91_TEMPLATE_ID;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SECRET_KEY;
  delete process.env.PHONE_LOOKUP_HMAC_KEY;

  const srv = await startTestServer();
  try {
    process.env.OTP_PROVIDER = 'demo';
    const healthDemo = await fetch(`${srv.baseUrl}/api/health`);
    assert.equal(healthDemo.status, 200);
    const healthDemoData = (await healthDemo.json()) as {
      ok: boolean;
      verificationMode: string;
    };
    assert.equal(healthDemoData.ok, true);
    assert.equal(healthDemoData.verificationMode, 'development_test');

    process.env.OTP_PROVIDER = 'twilio';
    const healthMisconfigured = await fetch(`${srv.baseUrl}/api/health`);
    const healthBadData = (await healthMisconfigured.json()) as { ok: boolean };
    assert.equal(healthBadData.ok, false);

    const twilioReq = await fetch(`${srv.baseUrl}/api/otp/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ countryCode: '+91', phoneNumber: '9876500011' }),
    });
    assert.equal(twilioReq.status, 503);

    // Supabase configured without PHONE_LOOKUP_HMAC_KEY must fail closed (503)
    process.env.OTP_PROVIDER = 'demo';
    process.env.SUPABASE_URL = 'https://edykghafxrrvsfbcxnkt.supabase.co';
    process.env.SUPABASE_SECRET_KEY = 'sb_secret_test_only_placeholder_value';
    const healthMissingHmac = await fetch(`${srv.baseUrl}/api/health`);
    assert.equal(healthMissingHmac.status, 503);
    const otpMissingHmac = await fetch(`${srv.baseUrl}/api/otp/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ countryCode: '+91', phoneNumber: '9876500011' }),
    });
    assert.equal(otpMissingHmac.status, 503);
    const statusMissingHmac = await fetch(`${srv.baseUrl}/api/registration/status`, {
      headers: { Authorization: 'Bearer some_fake_bearer_token_over_20_chars' },
    });
    assert.equal(statusMissingHmac.status, 503);
  } finally {
    resetDatabaseCacheForTests();
    if (prevProvider === undefined) delete process.env.OTP_PROVIDER;
    else process.env.OTP_PROVIDER = prevProvider;
    if (prevSid === undefined) delete process.env.TWILIO_ACCOUNT_SID;
    else process.env.TWILIO_ACCOUNT_SID = prevSid;
    if (prevToken === undefined) delete process.env.TWILIO_AUTH_TOKEN;
    else process.env.TWILIO_AUTH_TOKEN = prevToken;
    if (prevFrom === undefined) delete process.env.TWILIO_FROM_NUMBER;
    else process.env.TWILIO_FROM_NUMBER = prevFrom;
    if (prevMsg91Key === undefined) delete process.env.MSG91_AUTH_KEY;
    else process.env.MSG91_AUTH_KEY = prevMsg91Key;
    if (prevMsg91Tpl === undefined) delete process.env.MSG91_TEMPLATE_ID;
    else process.env.MSG91_TEMPLATE_ID = prevMsg91Tpl;
    if (prevSupabaseUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = prevSupabaseUrl;
    if (prevSupabaseSecret === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = prevSupabaseSecret;
    if (prevHmacKey === undefined) delete process.env.PHONE_LOOKUP_HMAC_KEY;
    else process.env.PHONE_LOOKUP_HMAC_KEY = prevHmacKey;
    await srv.close();
  }
});

test('OTP expiry (410), brute-force lockout (429), unknown challenge (404), API 404, and production demo block (503)', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'can-edge-test-'));
  const sqliteFile = path.join(tmpDir, 'edge.db');
  const prevSqlitePath = process.env.CAN_SQLITE_PATH;
  const prevNodeEnv = process.env.NODE_ENV;
  const prevProvider = process.env.OTP_PROVIDER;
  const prevAllowDemo = process.env.ALLOW_DEV_OTP_DEMO;

  process.env.CAN_SQLITE_PATH = sqliteFile;
  process.env.NODE_ENV = 'development';
  process.env.OTP_PROVIDER = 'demo';
  delete process.env.ALLOW_DEV_OTP_DEMO;
  resetDatabaseCacheForTests();

  const srv = await startTestServer();
  try {
    // Unknown /api/* returns 404 JSON
    const unknownApi = await fetch(`${srv.baseUrl}/api/does-not-exist`);
    assert.equal(unknownApi.status, 404);

    // Unknown challenge returns 404
    const unknownChallenge = await fetch(`${srv.baseUrl}/api/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challengeId: '11111111-1111-4111-8111-111111111111',
        code: '123456',
      }),
    });
    assert.equal(unknownChallenge.status, 404);

    // Expired OTP returns 410
    const otp1 = await fetch(`${srv.baseUrl}/api/otp/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ countryCode: '+91', phoneNumber: '9811112222' }),
    });
    assert.equal(otp1.status, 201);
    const otp1Body = (await otp1.json()) as { challengeId: string; devTestCode: string };

    const sqlite = new DatabaseSync(sqliteFile);
    sqlite
      .prepare('UPDATE otp_challenges SET expires_at = ? WHERE id = ?')
      .run(new Date(Date.now() - 60_000).toISOString(), otp1Body.challengeId);
    sqlite.close();

    const expiredRes = await fetch(`${srv.baseUrl}/api/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId: otp1Body.challengeId, code: otp1Body.devTestCode }),
    });
    assert.equal(expiredRes.status, 410);

    // Brute-force lockout after 5 wrong attempts returns 429
    const otp2 = await fetch(`${srv.baseUrl}/api/otp/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ countryCode: '+91', phoneNumber: '9811113333' }),
    });
    assert.equal(otp2.status, 201);
    const otp2Body = (await otp2.json()) as { challengeId: string; devTestCode: string };
    const wrongCode = otp2Body.devTestCode === '999999' ? '888888' : '999999';

    for (let i = 0; i < 5; i += 1) {
      const attempt = await fetch(`${srv.baseUrl}/api/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId: otp2Body.challengeId, code: wrongCode }),
      });
      assert.equal(attempt.status, 400);
    }

    const lockedAttempt = await fetch(`${srv.baseUrl}/api/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId: otp2Body.challengeId, code: otp2Body.devTestCode }),
    });
    assert.equal(lockedAttempt.status, 429);

    // Production mode must fail closed when OTP_PROVIDER=demo without ALLOW_DEV_OTP_DEMO=true
    process.env.NODE_ENV = 'production';
    process.env.OTP_PROVIDER = 'demo';
    const prodBlocked = await fetch(`${srv.baseUrl}/api/otp/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ countryCode: '+91', phoneNumber: '9811114444' }),
    });
    assert.equal(prodBlocked.status, 503);
  } finally {
    await srv.close();
    resetDatabaseCacheForTests();
    if (prevSqlitePath === undefined) delete process.env.CAN_SQLITE_PATH;
    else process.env.CAN_SQLITE_PATH = prevSqlitePath;
    if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNodeEnv;
    if (prevProvider === undefined) delete process.env.OTP_PROVIDER;
    else process.env.OTP_PROVIDER = prevProvider;
    if (prevAllowDemo === undefined) delete process.env.ALLOW_DEV_OTP_DEMO;
    else process.env.ALLOW_DEV_OTP_DEMO = prevAllowDemo;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('concurrent OTP requests reserve IP limits atomically and ignore spoofed X-Forwarded-For', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'can-rate-limit-test-'));
  const sqliteFile = path.join(tmpDir, 'rate-limit.db');
  const keys = [
    'CAN_SQLITE_PATH',
    'PHONE_LOOKUP_HMAC_KEY',
    'OTP_PROVIDER',
    'NODE_ENV',
    'VERCEL',
    'SUPABASE_URL',
    'SUPABASE_SECRET_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'CAN_SERVER_SECRET',
  ] as const;
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

  process.env.CAN_SQLITE_PATH = sqliteFile;
  process.env.PHONE_LOOKUP_HMAC_KEY = 'test-only-hmac-key-at-least-32-chars!!';
  process.env.OTP_PROVIDER = 'demo';
  process.env.NODE_ENV = 'development';
  for (const key of ['VERCEL', 'SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'CAN_SERVER_SECRET']) {
    delete process.env[key];
  }
  resetDatabaseCacheForTests();

  const srv = await startTestServer();
  try {
    const responses = await Promise.all(
      Array.from({ length: 15 }, (_, index) => {
        const suffix = String(1000 + index);
        return fetch(`${srv.baseUrl}/api/otp/request`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // These untrusted values must not create 15 separate client identities.
            'X-Forwarded-For': `198.51.100.${index + 1}`,
          },
          body: JSON.stringify({ countryCode: '+91', phoneNumber: `987654${suffix}` }),
        });
      }),
    );

    assert.equal(responses.filter((response) => response.status === 201).length, 12);
    assert.equal(responses.filter((response) => response.status === 429).length, 3);
  } finally {
    await srv.close();
    resetDatabaseCacheForTests();
    for (const key of keys) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});



test('concurrent invalid OTP submissions cannot exceed the per-challenge attempt limit', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'can-concurrent-otp-test-'));
  const previous = {
    sqlitePath: process.env.CAN_SQLITE_PATH,
    hmacKey: process.env.PHONE_LOOKUP_HMAC_KEY,
    provider: process.env.OTP_PROVIDER,
    nodeEnv: process.env.NODE_ENV,
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseSecret: process.env.SUPABASE_SECRET_KEY,
  };

  process.env.CAN_SQLITE_PATH = path.join(tmpDir, 'concurrent.db');
  process.env.PHONE_LOOKUP_HMAC_KEY = 'concurrency-test-hmac-key-at-least-32';
  process.env.OTP_PROVIDER = 'demo';
  process.env.NODE_ENV = 'development';
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SECRET_KEY;
  resetDatabaseCacheForTests();

  const srv = await startTestServer();
  try {
    const request = await fetch(`${srv.baseUrl}/api/otp/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ countryCode: '+91', phoneNumber: '9876543210' }),
    });
    assert.equal(request.status, 201);
    const challenge = (await request.json()) as { challengeId: string; devTestCode: string };
    const wrongCode = challenge.devTestCode === '000000' ? '111111' : '000000';

    const attempts = await Promise.all(
      Array.from({ length: 8 }, () =>
        fetch(`${srv.baseUrl}/api/otp/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ challengeId: challenge.challengeId, code: wrongCode }),
        }),
      ),
    );
    const statuses = attempts.map((response) => response.status);
    assert.equal(statuses.filter((status) => status === 400).length, 5);
    assert.equal(statuses.filter((status) => status === 429).length, 3);

    const sqlite = new DatabaseSync(path.join(tmpDir, 'concurrent.db'));
    const row = sqlite.prepare('SELECT attempts FROM otp_challenges WHERE id = ?')
      .get(challenge.challengeId) as { attempts: number };
    assert.equal(row.attempts, 5);
    sqlite.close();
  } finally {
    await srv.close();
    resetDatabaseCacheForTests();
    if (previous.sqlitePath === undefined) delete process.env.CAN_SQLITE_PATH;
    else process.env.CAN_SQLITE_PATH = previous.sqlitePath;
    if (previous.hmacKey === undefined) delete process.env.PHONE_LOOKUP_HMAC_KEY;
    else process.env.PHONE_LOOKUP_HMAC_KEY = previous.hmacKey;
    if (previous.provider === undefined) delete process.env.OTP_PROVIDER;
    else process.env.OTP_PROVIDER = previous.provider;
    if (previous.nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous.nodeEnv;
    if (previous.supabaseUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previous.supabaseUrl;
    if (previous.supabaseSecret === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = previous.supabaseSecret;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
