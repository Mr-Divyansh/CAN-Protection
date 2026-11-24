import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createSupabasePhoneRegistrationsAdapter,
  getDatabase,
  PHONE_REGISTRATIONS_COLUMNS,
  PHONE_REGISTRATIONS_SELECT,
  resetDatabaseCacheForTests,
  type DbPhoneRegistrationRow,
} from './db.ts';

function createMockSupabaseClient(initialRows: DbPhoneRegistrationRow[] = [], options?: {
  simulateSchemaError?: string;
  simulateUniqueRaceOnce?: boolean;
}) {
  const rows = new Map<string, DbPhoneRegistrationRow>(
    initialRows.map((r) => [r.phone_number_hash, { ...r }]),
  );
  const recordedCalls: Array<{
    table: string;
    op: 'select' | 'insert' | 'update';
    selectCols?: string;
    payload?: Record<string, unknown>;
    filters: Array<[string, unknown]>;
  }> = [];
  let uniqueRacePending = options?.simulateUniqueRaceOnce ?? false;

  const client = {
    from(table: string) {
      let op: 'select' | 'insert' | 'update' = 'select';
      let selectCols: string | undefined;
      let payload: Record<string, unknown> | undefined;
      const filters: Array<[string, unknown]> = [];
      let limitCount: number | undefined;

      const execute = async (mode: 'many' | 'maybeSingle' | 'single') => {
        recordedCalls.push({
          table,
          op,
          selectCols,
          payload: payload ? { ...payload } : undefined,
          filters: [...filters],
        });

        if (table !== 'phone_registrations') {
          return { data: null, error: { message: `Unexpected table ${table}` } };
        }

        if (options?.simulateSchemaError) {
          return { data: null, error: { message: options.simulateSchemaError } };
        }

        const findMatches = () => {
          return Array.from(rows.values()).filter((row) =>
            filters.every(([k, v]) => (row as unknown as Record<string, unknown>)[k] === v),
          );
        };

        if (op === 'select') {
          const matches = findMatches();
          const sliced = limitCount !== undefined ? matches.slice(0, limitCount) : matches;
          if (mode === 'maybeSingle') {
            return { data: sliced[0] ? { ...sliced[0] } : null, error: null };
          }
          if (mode === 'single') {
            return sliced[0]
              ? { data: { ...sliced[0] }, error: null }
              : { data: null, error: { message: 'No row found' } };
          }
          return { data: sliced.map((r) => ({ ...r })), error: null };
        }

        if (op === 'insert' && payload) {
          const hash = String(payload.phone_number_hash);
          if (uniqueRacePending) {
            uniqueRacePending = false;
            return {
              data: null,
              error: { code: '23505', message: 'duplicate key value violates unique constraint' },
            };
          }
          if (rows.has(hash)) {
            return {
              data: null,
              error: { code: '23505', message: 'duplicate key value violates unique constraint' },
            };
          }
          const newRow = { ...(payload as unknown as DbPhoneRegistrationRow) };
          rows.set(hash, newRow);
          return { data: { ...newRow }, error: null };
        }

        if (op === 'update' && payload) {
          const matches = findMatches();
          if (matches.length === 0) {
            return { data: null, error: { message: 'Row not found for update' } };
          }
          const target = matches[0];
          const updated: DbPhoneRegistrationRow = {
            ...target,
            ...(payload as Partial<DbPhoneRegistrationRow>),
          };
          rows.set(updated.phone_number_hash, updated);
          return { data: { ...updated }, error: null };
        }

        return { data: null, error: { message: 'Unsupported mock operation' } };
      };

      const builder = {
        select(cols: string) {
          selectCols = cols;
          return builder;
        },
        insert(data: Record<string, unknown>) {
          op = 'insert';
          payload = data;
          return builder;
        },
        update(data: Record<string, unknown>) {
          op = 'update';
          payload = data;
          return builder;
        },
        eq(column: string, value: unknown) {
          filters.push([column, value]);
          return builder;
        },
        limit(count: number) {
          limitCount = count;
          return execute('many');
        },
        maybeSingle() {
          return execute('maybeSingle');
        },
        single() {
          return execute('single');
        },
      };

      return builder;
    },
  };

  return {
    client: client as unknown as SupabaseClient,
    recordedCalls,
    rows,
  };
}

test('Supabase phone_registrations adapter enforces exact 10-column schema, no raw phone, and explicit updated_at', async () => {
  const hash = 'a'.repeat(64);
  const { client, recordedCalls } = createMockSupabaseClient();
  const adapter = createSupabasePhoneRegistrationsAdapter(client);

  const schemaRes = await adapter.verifySchema?.();
  assert.deepEqual(schemaRes, { ok: true });

  const initial = await adapter.getRegistrationByPhoneHash(hash);
  assert.equal(initial, null);

  const t1 = '2026-11-24T10:00:00.000Z';
  const created = await adapter.upsertActivateRegistration({
    phoneNumberHash: hash,
    phoneLast4: '3210',
    countryCode: '+91',
    verifiedAt: t1,
    nowIso: t1,
  });

  assert.equal(created.phone_number_hash, hash);
  assert.equal(created.phone_last4, '3210');
  assert.equal(created.country_code, '+91');
  assert.equal(created.status, 'active');
  assert.equal(created.verified_at, t1);
  assert.equal(created.activated_at, t1);
  assert.equal(created.deactivated_at, null);
  assert.equal(created.created_at, t1);
  assert.equal(created.updated_at, t1);
  assert.deepEqual(Object.keys(created).sort(), [...PHONE_REGISTRATIONS_COLUMNS].sort());

  // Re-verify while already active updates verified_at and updated_at without changing activated_at
  const t2 = '2026-11-24T10:05:00.000Z';
  const reverified = await adapter.upsertActivateRegistration({
    phoneNumberHash: hash,
    phoneLast4: '3210',
    countryCode: '+91',
    verifiedAt: t2,
    nowIso: t2,
  });
  assert.equal(reverified.status, 'active');
  assert.equal(reverified.activated_at, t1);
  assert.equal(reverified.verified_at, t2);
  assert.equal(reverified.updated_at, t2);

  // Deactivate updates status, deactivated_at, and updated_at
  const t3 = '2026-11-24T10:10:00.000Z';
  const deactivated = await adapter.deactivateRegistration({
    phoneNumberHash: hash,
    nowIso: t3,
  });
  assert.ok(deactivated);
  assert.equal(deactivated.status, 'inactive');
  assert.equal(deactivated.deactivated_at, t3);
  assert.equal(deactivated.updated_at, t3);

  // Reactivate updates status, activated_at, verified_at, and updated_at
  const t4 = '2026-11-24T10:15:00.000Z';
  const reactivated = await adapter.upsertActivateRegistration({
    phoneNumberHash: hash,
    phoneLast4: '3210',
    countryCode: '+91',
    verifiedAt: t4,
    nowIso: t4,
  });
  assert.equal(reactivated.status, 'active');
  assert.equal(reactivated.activated_at, t4);
  assert.equal(reactivated.updated_at, t4);

  // Assert every query targeted only phone_registrations and never wrote phone_number_normalized
  for (const call of recordedCalls) {
    assert.equal(call.table, 'phone_registrations');
    if (call.selectCols) {
      assert.equal(call.selectCols, PHONE_REGISTRATIONS_SELECT);
    }
    if (call.payload) {
      assert.equal('phone_number_normalized' in call.payload, false);
      assert.ok('updated_at' in call.payload);
    }
  }
});

test('Supabase adapter recovers cleanly from concurrent unique insert race (23505)', async () => {
  const hash = 'b'.repeat(64);
  const existingRow: DbPhoneRegistrationRow = {
    id: '11111111-1111-4111-8111-111111111111',
    phone_number_hash: hash,
    phone_last4: '4321',
    country_code: '+91',
    status: 'inactive',
    verified_at: '2026-11-24T09:00:00.000Z',
    activated_at: '2026-11-24T09:00:00.000Z',
    deactivated_at: '2026-11-24T09:30:00.000Z',
    created_at: '2026-11-24T09:00:00.000Z',
    updated_at: '2026-11-24T09:30:00.000Z',
  };
  const { client } = createMockSupabaseClient([], { simulateUniqueRaceOnce: true });
  let lookupCount = 0;
  // Simulate row inserted concurrently right before retry lookup:
  const adapter = createSupabasePhoneRegistrationsAdapter({
    from(table: string) {
      const base = client.from(table);
      return {
        select(cols: string) {
          const sb = base.select(cols);
          return {
            eq(col: string, val: unknown) {
              const filtered = sb.eq(col, val);
              return {
                maybeSingle: async () => {
                  lookupCount += 1;
                  if (lookupCount === 1) {
                    return { data: null, error: null };
                  }
                  return { data: existingRow, error: null };
                },
              };
            },
          };
        },
        insert() {
          return {
            select() {
              return {
                single: async () => ({
                  data: null,
                  error: { code: '23505', message: 'duplicate key value violates unique constraint' },
                }),
              };
            },
          };
        },
        update(patch: Record<string, unknown>) {
          return {
            eq() {
              return {
                eq() {
                  return {
                    select() {
                      return {
                        single: async () => ({
                          data: { ...existingRow, ...patch },
                          error: null,
                        }),
                      };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient);

  const tNext = '2026-11-24T11:00:00.000Z';
  const row = await adapter.upsertActivateRegistration({
    phoneNumberHash: hash,
    phoneLast4: '4321',
    countryCode: '+91',
    verifiedAt: tNext,
    nowIso: tNext,
  });

  assert.equal(row.status, 'active');
  assert.equal(row.activated_at, tNext);
  assert.equal(row.updated_at, tNext);
});

test('Supabase verifySchema surfaces mismatch error clearly', async () => {
  const { client } = createMockSupabaseClient([], {
    simulateSchemaError: 'column phone_registrations.phone_last4 does not exist',
  });
  const adapter = createSupabasePhoneRegistrationsAdapter(client);
  const check = await adapter.verifySchema?.();
  assert.equal(check?.ok, false);
  assert.match(check?.error ?? '', /phone_last4/);

  await assert.rejects(
    () =>
      adapter.upsertActivateRegistration({
        phoneNumberHash: 'd'.repeat(64),
        phoneLast4: '0000',
        countryCode: '+91',
        verifiedAt: '2026-11-24T12:00:00.000Z',
        nowIso: '2026-11-24T12:00:00.000Z',
      }),
    /Supabase phone_registrations lookup failed/,
  );
});

test('SQLite fallback removes legacy raw-phone tables and enforces hash-only schema', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'can-db-test-'));
  const sqliteFile = path.join(tmpDir, 'test.db');
  const prevPath = process.env.CAN_SQLITE_PATH;

  try {
    // Seed a legacy database with phone_number_normalized columns
    const legacy = new DatabaseSync(sqliteFile);
    legacy.exec(`
      CREATE TABLE registrations (id TEXT PRIMARY KEY, phone_number_normalized TEXT);
      CREATE TABLE otp_challenges (id TEXT PRIMARY KEY, phone_number_normalized TEXT);
      CREATE TABLE verified_sessions (id TEXT PRIMARY KEY, phone_number_normalized TEXT);
    `);
    legacy.close();

    process.env.CAN_SQLITE_PATH = sqliteFile;
    resetDatabaseCacheForTests();
    const db = getDatabase();
    assert.equal(db.backend, 'local_sqlite_dev');

    const hash = 'c'.repeat(64);
    const created = await db.upsertActivateRegistration({
      phoneNumberHash: hash,
      phoneLast4: '9988',
      countryCode: '+91',
      verifiedAt: '2026-11-24T12:00:00.000Z',
      nowIso: '2026-11-24T12:00:00.000Z',
    });
    assert.equal(created.status, 'active');
    assert.equal(created.phone_last4, '9988');

    const inspected = new DatabaseSync(sqliteFile);
    const tables = inspected
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as Array<{ name: string }>;
    const tableNames = tables.map((t) => t.name);
    assert.equal(tableNames.includes('registrations'), false);
    assert.equal(tableNames.includes('phone_registrations'), true);

    for (const table of ['phone_registrations', 'otp_challenges', 'verified_sessions']) {
      const cols = inspected.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
      assert.equal(
        cols.some((c) => c.name === 'phone_number_normalized'),
        false,
        `Table ${table} must not store raw phone_number_normalized`,
      );
    }

    const regCols = inspected
      .prepare('PRAGMA table_info(phone_registrations)')
      .all() as Array<{ name: string }>;
    assert.deepEqual(
      regCols.map((c) => c.name).sort(),
      [...PHONE_REGISTRATIONS_COLUMNS].sort(),
    );
    inspected.close();
  } finally {
    resetDatabaseCacheForTests();
    if (prevPath === undefined) delete process.env.CAN_SQLITE_PATH;
    else process.env.CAN_SQLITE_PATH = prevPath;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});


test('OTP challenge cannot be consumed after the atomic maximum-attempt threshold is reached', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'can-otp-lockout-db-test-'));
  const previous = {
    sqlitePath: process.env.CAN_SQLITE_PATH,
    hmacKey: process.env.PHONE_LOOKUP_HMAC_KEY,
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseSecret: process.env.SUPABASE_SECRET_KEY,
  };

  process.env.CAN_SQLITE_PATH = path.join(tmpDir, 'lockout.db');
  process.env.PHONE_LOOKUP_HMAC_KEY = 'db-lockout-test-hmac-key-at-least-32';
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SECRET_KEY;
  resetDatabaseCacheForTests();

  try {
    const db = getDatabase();
    const challengeId = '22222222-2222-4222-8222-222222222222';
    const now = new Date().toISOString();
    await db.createOtpChallenge({
      id: challengeId,
      phoneHash: 'c'.repeat(64),
      phoneLast4: '4321',
      countryCode: '+91',
      otpHash: 'd'.repeat(64),
      maxAttempts: 5,
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
      resendAvailableAt: new Date(Date.now() + 30_000).toISOString(),
      createdAt: now,
    });

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      assert.equal(await db.incrementOtpAttempts(challengeId, 5), attempt);
    }
    assert.equal(await db.incrementOtpAttempts(challengeId, 5), null);
    assert.equal(await db.consumeOtpChallenge(challengeId, now, 5), false);

    const locked = await db.getOtpChallengeById(challengeId);
    assert.equal(locked?.attempts, 5);
    assert.equal(locked?.consumed_at, null);
  } finally {
    resetDatabaseCacheForTests();
    if (previous.sqlitePath === undefined) delete process.env.CAN_SQLITE_PATH;
    else process.env.CAN_SQLITE_PATH = previous.sqlitePath;
    if (previous.hmacKey === undefined) delete process.env.PHONE_LOOKUP_HMAC_KEY;
    else process.env.PHONE_LOOKUP_HMAC_KEY = previous.hmacKey;
    if (previous.supabaseUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previous.supabaseUrl;
    if (previous.supabaseSecret === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = previous.supabaseSecret;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
