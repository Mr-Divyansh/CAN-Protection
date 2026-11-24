import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { validateStorageEnvironment } from './env.ts';

export const PHONE_REGISTRATIONS_COLUMNS = [
  'id',
  'phone_number_hash',
  'phone_last4',
  'country_code',
  'status',
  'verified_at',
  'activated_at',
  'deactivated_at',
  'created_at',
  'updated_at',
] as const;

export const PHONE_REGISTRATIONS_SELECT = PHONE_REGISTRATIONS_COLUMNS.join(', ');

export interface DbPhoneRegistrationRow {
  id: string;
  phone_number_hash: string;
  phone_last4: string;
  country_code: string;
  status: 'active' | 'inactive';
  verified_at: string;
  activated_at: string | null;
  deactivated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbOtpChallengeRow {
  id: string;
  phone_hash: string;
  phone_last4: string;
  country_code: string;
  otp_hash: string;
  attempts: number;
  max_attempts: number;
  expires_at: string;
  resend_available_at: string;
  consumed_at: string | null;
  created_at: string;
}

export interface DbSessionRow {
  id: string;
  token_hash: string;
  phone_hash: string;
  phone_last4: string;
  country_code: string;
  verification_mode: 'development_test' | 'provider';
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
}

export interface ActivateRegistrationInput {
  phoneNumberHash: string;
  phoneLast4: string;
  countryCode: string;
  verifiedAt: string;
  nowIso: string;
}

export interface DeactivateRegistrationInput {
  phoneNumberHash: string;
  nowIso: string;
}

export interface PhoneRegistrationsStore {
  getRegistrationByPhoneHash(phoneNumberHash: string): Promise<DbPhoneRegistrationRow | null>;
  upsertActivateRegistration(input: ActivateRegistrationInput): Promise<DbPhoneRegistrationRow>;
  deactivateRegistration(input: DeactivateRegistrationInput): Promise<DbPhoneRegistrationRow | null>;
  verifySchema?(): Promise<{ ok: boolean; error?: string }>;
}

export interface CanDatabase extends PhoneRegistrationsStore {
  backend: 'supabase_postgres' | 'local_sqlite_dev';
  getRateLimitTimestamps(bucketKey: string, sinceMs: number): Promise<number[]>;
  reserveRateLimitEvent(bucketKey: string, createdAtMs: number, sinceMs: number, maxRequests: number): Promise<{ allowed: boolean; retryAfterSeconds: number }>;
  recordRateLimitEvent(bucketKey: string, createdAtMs: number, pruneBeforeMs: number): Promise<void>;
  getLatestChallengeForPhoneHash(phoneHash: string): Promise<DbOtpChallengeRow | null>;
  createOtpChallenge(input: {
    id: string;
    phoneHash: string;
    phoneLast4: string;
    countryCode: string;
    otpHash: string;
    maxAttempts: number;
    expiresAt: string;
    resendAvailableAt: string;
    createdAt: string;
  }): Promise<void>;
  getOtpChallengeById(id: string): Promise<DbOtpChallengeRow | null>;
  incrementOtpAttempts(id: string, maxAttempts: number): Promise<number | null>;
  consumeOtpChallenge(id: string, consumedAt: string, maxAttempts: number): Promise<boolean>;
  createVerifiedSession(input: {
    id: string;
    tokenHash: string;
    phoneHash: string;
    phoneLast4: string;
    countryCode: string;
    verificationMode: 'development_test' | 'provider';
    expiresAt: string;
    createdAt: string;
  }): Promise<void>;
  getSessionByTokenHash(tokenHash: string): Promise<DbSessionRow | null>;
  revokeSessionByTokenHash(tokenHash: string, revokedAt: string): Promise<void>;
}

function resolveSqlitePath(): string {
  const customPath = process.env.CAN_SQLITE_PATH?.trim();
  if (customPath) {
    fs.mkdirSync(path.dirname(customPath), { recursive: true });
    return customPath;
  }

  const preferredDir = path.resolve(process.cwd(), 'data');
  try {
    fs.mkdirSync(preferredDir, { recursive: true });
    return path.join(preferredDir, 'can-protection.db');
  } catch {
    const tmpDir = path.join(os.tmpdir(), 'can-protection');
    fs.mkdirSync(tmpDir, { recursive: true });
    return path.join(tmpDir, 'can-protection.db');
  }
}

function tableHasColumn(db: DatabaseSync, tableName: string, columnName: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return rows.some((row) => row.name === columnName);
}

function tableExists(db: DatabaseSync, tableName: string): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName) as { name: string } | undefined;
  return Boolean(row);
}

function openInitializedSqlite(): DatabaseSync {
  const dbPath = resolveSqlitePath();
  const db = new DatabaseSync(dbPath);

  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

  // Remove any legacy development tables that stored raw normalized phone numbers.
  if (tableExists(db, 'registrations')) {
    db.exec('DROP TABLE IF EXISTS registrations;');
  }
  if (tableExists(db, 'phone_registrations') && tableHasColumn(db, 'phone_registrations', 'phone_number_normalized')) {
    db.exec('DROP TABLE IF EXISTS phone_registrations;');
  }
  if (tableExists(db, 'otp_challenges') && tableHasColumn(db, 'otp_challenges', 'phone_number_normalized')) {
    db.exec('DROP TABLE IF EXISTS otp_challenges;');
  }
  if (tableExists(db, 'verified_sessions') && tableHasColumn(db, 'verified_sessions', 'phone_number_normalized')) {
    db.exec('DROP TABLE IF EXISTS verified_sessions;');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS phone_registrations (
      id TEXT PRIMARY KEY,
      phone_number_hash TEXT NOT NULL UNIQUE,
      phone_last4 TEXT NOT NULL,
      country_code TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('active', 'inactive')),
      verified_at TEXT NOT NULL,
      activated_at TEXT,
      deactivated_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_phone_registrations_single_active
      ON phone_registrations(phone_number_hash)
      WHERE status = 'active';

    CREATE TABLE IF NOT EXISTS otp_challenges (
      id TEXT PRIMARY KEY,
      phone_hash TEXT NOT NULL,
      phone_last4 TEXT NOT NULL,
      country_code TEXT NOT NULL,
      otp_hash TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 5,
      expires_at TEXT NOT NULL,
      resend_available_at TEXT NOT NULL,
      consumed_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_otp_challenges_phone_hash
      ON otp_challenges(phone_hash, created_at DESC);

    CREATE TABLE IF NOT EXISTS verified_sessions (
      id TEXT PRIMARY KEY,
      token_hash TEXT NOT NULL UNIQUE,
      phone_hash TEXT NOT NULL,
      phone_last4 TEXT NOT NULL,
      country_code TEXT NOT NULL,
      verification_mode TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rate_limit_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bucket_key TEXT NOT NULL,
      created_at_ms INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_rate_limit_bucket
      ON rate_limit_events(bucket_key, created_at_ms DESC);
  `);

  return db;
}

function createSqliteTransientHandlers(db: DatabaseSync): Pick<
  CanDatabase,
  | 'getRateLimitTimestamps'
  | 'reserveRateLimitEvent'
  | 'recordRateLimitEvent'
  | 'getLatestChallengeForPhoneHash'
  | 'createOtpChallenge'
  | 'getOtpChallengeById'
  | 'incrementOtpAttempts'
  | 'consumeOtpChallenge'
  | 'createVerifiedSession'
  | 'getSessionByTokenHash'
  | 'revokeSessionByTokenHash'
> {
  return {
    async getRateLimitTimestamps(bucketKey, sinceMs) {
      const rows = db
        .prepare(
          'SELECT created_at_ms FROM rate_limit_events WHERE bucket_key = ? AND created_at_ms > ? ORDER BY created_at_ms ASC',
        )
        .all(bucketKey, sinceMs) as Array<{ created_at_ms: number }>;
      return rows.map((r) => Number(r.created_at_ms));
    },

    async reserveRateLimitEvent(bucketKey, createdAtMs, sinceMs, maxRequests) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const rows = db
          .prepare(
            'SELECT created_at_ms FROM rate_limit_events WHERE bucket_key = ? AND created_at_ms > ? ORDER BY created_at_ms ASC',
          )
          .all(bucketKey, sinceMs) as Array<{ created_at_ms: number }>;

        if (rows.length >= maxRequests) {
          db.exec('ROLLBACK');
          const oldest = Number(rows[0].created_at_ms);
          const windowMs = createdAtMs - sinceMs;
          return {
            allowed: false,
            retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (createdAtMs - oldest)) / 1000)),
          };
        }

        db.prepare('DELETE FROM rate_limit_events WHERE created_at_ms <= ?').run(sinceMs);
        db.prepare('INSERT INTO rate_limit_events (bucket_key, created_at_ms) VALUES (?, ?)').run(
          bucketKey,
          createdAtMs,
        );
        db.exec('COMMIT');
        return { allowed: true, retryAfterSeconds: 0 };
      } catch (error) {
        try { db.exec('ROLLBACK'); } catch { /* transaction may already be closed */ }
        throw error;
      }
    },

    async recordRateLimitEvent(bucketKey, createdAtMs, pruneBeforeMs) {
      db.prepare('DELETE FROM rate_limit_events WHERE created_at_ms < ?').run(pruneBeforeMs);
      db.prepare('INSERT INTO rate_limit_events (bucket_key, created_at_ms) VALUES (?, ?)').run(
        bucketKey,
        createdAtMs,
      );
    },

    async getLatestChallengeForPhoneHash(phoneHash) {
      const row = db
        .prepare(
          'SELECT * FROM otp_challenges WHERE phone_hash = ? ORDER BY created_at DESC LIMIT 1',
        )
        .get(phoneHash) as DbOtpChallengeRow | undefined;
      return row ?? null;
    },

    async createOtpChallenge(input) {
      db.prepare(
        `INSERT INTO otp_challenges
         (id, phone_hash, phone_last4, country_code, otp_hash, attempts, max_attempts, expires_at, resend_available_at, consumed_at, created_at)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, NULL, ?)`,
      ).run(
        input.id,
        input.phoneHash,
        input.phoneLast4,
        input.countryCode,
        input.otpHash,
        input.maxAttempts,
        input.expiresAt,
        input.resendAvailableAt,
        input.createdAt,
      );
    },

    async getOtpChallengeById(id) {
      const row = db
        .prepare('SELECT * FROM otp_challenges WHERE id = ?')
        .get(id) as DbOtpChallengeRow | undefined;
      return row ?? null;
    },

    async incrementOtpAttempts(id, maxAttempts) {
      const result = db.prepare(
        'UPDATE otp_challenges SET attempts = attempts + 1 WHERE id = ? AND attempts < ? AND consumed_at IS NULL RETURNING attempts',
      ).get(id, maxAttempts) as { attempts: number } | undefined;
      return result ? Number(result.attempts) : null;
    },

    async consumeOtpChallenge(id, consumedAt, maxAttempts) {
      const result = db
        .prepare('UPDATE otp_challenges SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL AND attempts < ?')
        .run(consumedAt, id, maxAttempts);
      return Number(result.changes) > 0;
    },

    async createVerifiedSession(input) {
      db.prepare(
        `INSERT INTO verified_sessions
         (id, token_hash, phone_hash, phone_last4, country_code, verification_mode, expires_at, revoked_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
      ).run(
        input.id,
        input.tokenHash,
        input.phoneHash,
        input.phoneLast4,
        input.countryCode,
        input.verificationMode,
        input.expiresAt,
        input.createdAt,
      );
    },

    async getSessionByTokenHash(tokenHash) {
      const row = db
        .prepare('SELECT * FROM verified_sessions WHERE token_hash = ?')
        .get(tokenHash) as DbSessionRow | undefined;
      return row ?? null;
    },

    async revokeSessionByTokenHash(tokenHash, revokedAt) {
      db.prepare('UPDATE verified_sessions SET revoked_at = ? WHERE token_hash = ?').run(
        revokedAt,
        tokenHash,
      );
    },
  };
}

function createSqlitePhoneRegistrationsStore(db: DatabaseSync): PhoneRegistrationsStore {
  return {
    async getRegistrationByPhoneHash(phoneNumberHash) {
      const row = db
        .prepare(
          `SELECT ${PHONE_REGISTRATIONS_SELECT} FROM phone_registrations WHERE phone_number_hash = ? LIMIT 1`,
        )
        .get(phoneNumberHash) as DbPhoneRegistrationRow | undefined;
      return row ?? null;
    },

    async upsertActivateRegistration(input) {
      const existing = db
        .prepare(
          `SELECT ${PHONE_REGISTRATIONS_SELECT} FROM phone_registrations WHERE phone_number_hash = ? LIMIT 1`,
        )
        .get(input.phoneNumberHash) as DbPhoneRegistrationRow | undefined;

      if (existing) {
        if (existing.status === 'active') {
          db.prepare(
            `UPDATE phone_registrations
             SET phone_last4 = ?, country_code = ?, verified_at = ?, updated_at = ?
             WHERE id = ?`,
          ).run(input.phoneLast4, input.countryCode, input.verifiedAt, input.nowIso, existing.id);
        } else {
          db.prepare(
            `UPDATE phone_registrations
             SET status = 'active', phone_last4 = ?, country_code = ?, verified_at = ?, activated_at = ?, updated_at = ?
             WHERE id = ?`,
          ).run(
            input.phoneLast4,
            input.countryCode,
            input.verifiedAt,
            input.nowIso,
            input.nowIso,
            existing.id,
          );
        }
        return db
          .prepare(`SELECT ${PHONE_REGISTRATIONS_SELECT} FROM phone_registrations WHERE id = ?`)
          .get(existing.id) as unknown as DbPhoneRegistrationRow;
      }

      const id = crypto.randomUUID();
      db.prepare(
        `INSERT INTO phone_registrations
         (id, phone_number_hash, phone_last4, country_code, status, verified_at, activated_at, deactivated_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'active', ?, ?, NULL, ?, ?)`,
      ).run(
        id,
        input.phoneNumberHash,
        input.phoneLast4,
        input.countryCode,
        input.verifiedAt,
        input.nowIso,
        input.nowIso,
        input.nowIso,
      );

      return db
        .prepare(`SELECT ${PHONE_REGISTRATIONS_SELECT} FROM phone_registrations WHERE id = ?`)
        .get(id) as unknown as DbPhoneRegistrationRow;
    },

    async deactivateRegistration(input) {
      const existing = db
        .prepare(
          `SELECT ${PHONE_REGISTRATIONS_SELECT} FROM phone_registrations WHERE phone_number_hash = ? LIMIT 1`,
        )
        .get(input.phoneNumberHash) as DbPhoneRegistrationRow | undefined;

      if (!existing) {
        return null;
      }

      db.prepare(
        `UPDATE phone_registrations
         SET status = 'inactive', deactivated_at = ?, updated_at = ?
         WHERE id = ?`,
      ).run(input.nowIso, input.nowIso, existing.id);

      return db
        .prepare(`SELECT ${PHONE_REGISTRATIONS_SELECT} FROM phone_registrations WHERE id = ?`)
        .get(existing.id) as unknown as DbPhoneRegistrationRow;
    },

    async verifySchema() {
      return { ok: true };
    },
  };
}

export function createSupabasePhoneRegistrationsAdapter(
  client: SupabaseClient,
): PhoneRegistrationsStore {
  async function findByHash(phoneNumberHash: string): Promise<DbPhoneRegistrationRow | null> {
    const { data, error } = await client
      .from('phone_registrations')
      .select(PHONE_REGISTRATIONS_SELECT)
      .eq('phone_number_hash', phoneNumberHash)
      .maybeSingle();

    if (error) {
      throw new Error(`Supabase phone_registrations lookup failed: ${error.message}`);
    }

    return (data as unknown as DbPhoneRegistrationRow | null) ?? null;
  }

  async function updateExistingToActive(
    existing: DbPhoneRegistrationRow,
    input: ActivateRegistrationInput,
  ): Promise<DbPhoneRegistrationRow> {
    const patch =
      existing.status === 'active'
        ? {
            phone_last4: input.phoneLast4,
            country_code: input.countryCode,
            verified_at: input.verifiedAt,
            updated_at: input.nowIso,
          }
        : {
            status: 'active' as const,
            phone_last4: input.phoneLast4,
            country_code: input.countryCode,
            verified_at: input.verifiedAt,
            activated_at: input.nowIso,
            updated_at: input.nowIso,
          };

    const { data, error } = await client
      .from('phone_registrations')
      .update(patch)
      .eq('id', existing.id)
      .eq('phone_number_hash', input.phoneNumberHash)
      .select(PHONE_REGISTRATIONS_SELECT)
      .single();

    if (error || !data) {
      throw new Error(
        `Supabase phone_registrations update failed: ${error?.message ?? 'No row returned'}`,
      );
    }

    return data as unknown as DbPhoneRegistrationRow;
  }

  return {
    getRegistrationByPhoneHash: findByHash,

    async upsertActivateRegistration(input) {
      const existing = await findByHash(input.phoneNumberHash);
      if (existing) {
        return updateExistingToActive(existing, input);
      }

      const insertPayload: DbPhoneRegistrationRow = {
        id: crypto.randomUUID(),
        phone_number_hash: input.phoneNumberHash,
        phone_last4: input.phoneLast4,
        country_code: input.countryCode,
        status: 'active',
        verified_at: input.verifiedAt,
        activated_at: input.nowIso,
        deactivated_at: null,
        created_at: input.nowIso,
        updated_at: input.nowIso,
      };

      const { data, error } = await client
        .from('phone_registrations')
        .insert(insertPayload)
        .select(PHONE_REGISTRATIONS_SELECT)
        .single();

      if (error) {
        // Recover cleanly from concurrent activation races hitting unique phone_number_hash constraints.
        if (error.code === '23505') {
          const raced = await findByHash(input.phoneNumberHash);
          if (raced) {
            return updateExistingToActive(raced, input);
          }
        }
        throw new Error(`Supabase phone_registrations insert failed: ${error.message}`);
      }

      if (!data) {
        throw new Error('Supabase phone_registrations insert failed: No row returned');
      }

      return data as unknown as DbPhoneRegistrationRow;
    },

    async deactivateRegistration(input) {
      const existing = await findByHash(input.phoneNumberHash);
      if (!existing) {
        return null;
      }

      const { data, error } = await client
        .from('phone_registrations')
        .update({
          status: 'inactive',
          deactivated_at: input.nowIso,
          updated_at: input.nowIso,
        })
        .eq('id', existing.id)
        .eq('phone_number_hash', input.phoneNumberHash)
        .select(PHONE_REGISTRATIONS_SELECT)
        .single();

      if (error) {
        throw new Error(`Supabase phone_registrations deactivation failed: ${error.message}`);
      }

      return (data as unknown as DbPhoneRegistrationRow | null) ?? null;
    },

    async verifySchema() {
      const { error } = await client
        .from('phone_registrations')
        .select(PHONE_REGISTRATIONS_SELECT)
        .limit(1);

      if (error) {
        return {
          ok: false,
          error: `public.phone_registrations schema check failed: ${error.message}`,
        };
      }
      return { ok: true };
    },
  };
}

let cachedDb: CanDatabase | null = null;
let cachedEnvSignature: string | null = null;

export function resetDatabaseCacheForTests(): void {
  cachedDb = null;
  cachedEnvSignature = null;
}

export function getDatabase(): CanDatabase {
  const storageEnv = validateStorageEnvironment(process.env);
  if (!storageEnv.valid) {
    throw new Error(storageEnv.error);
  }

  const signature = JSON.stringify({
    backend: storageEnv.backend,
    supabaseUrl: storageEnv.supabaseUrl ?? '',
    secretHash: storageEnv.supabaseSecretKey
      ? crypto.createHash('sha256').update(storageEnv.supabaseSecretKey).digest('hex')
      : '',
    sqlitePath: process.env.CAN_SQLITE_PATH?.trim() ?? '',
  });

  if (cachedDb && cachedEnvSignature === signature) {
    return cachedDb;
  }

  const sqlite = openInitializedSqlite();
  const transientHandlers = createSqliteTransientHandlers(sqlite);

  if (storageEnv.backend === 'supabase_postgres') {
    const supabaseClient = createClient(
      storageEnv.supabaseUrl!,
      storageEnv.supabaseSecretKey!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );
    const registrationsStore = createSupabasePhoneRegistrationsAdapter(supabaseClient);
    cachedDb = {
      backend: 'supabase_postgres',
      ...transientHandlers,
      ...registrationsStore,
    };
    cachedEnvSignature = signature;
    return cachedDb;
  }

  const localStore = createSqlitePhoneRegistrationsStore(sqlite);
  cachedDb = {
    backend: 'local_sqlite_dev',
    ...transientHandlers,
    ...localStore,
  };
  cachedEnvSignature = signature;
  return cachedDb;
}
