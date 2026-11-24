import path from 'node:path';

export type OtpProviderKind = 'demo' | 'twilio' | 'msg91';

export type OtpEnvValidationResult =
  | { valid: true; provider: OtpProviderKind; verificationMode: 'development_test' | 'provider'; providerName: string }
  | { valid: false; provider: string; missingVars: string[]; error: string };

export type StorageEnvValidationResult =
  | { valid: true; backend: 'supabase_postgres' | 'local_sqlite_dev'; supabaseUrl?: string; supabaseSecretKey?: string; phoneLookupHmacKey?: string }
  | { valid: false; backend: 'supabase_postgres'; missingVars: string[]; error: string };

export function isProductionEnvironment(env: Record<string, string | undefined> = process.env): boolean {
  return env.NODE_ENV === 'production' || env.VERCEL === '1';
}

export function hasRealEnvValue(value: string | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  return trimmed.length > 0 && !trimmed.startsWith('MY_');
}

export function validateOtpEnvironment(
  env: Record<string, string | undefined> = process.env,
): OtpEnvValidationResult {
  const rawProvider = env.OTP_PROVIDER?.trim().toLowerCase() ?? '';
  const normalizedProvider = rawProvider === '' || rawProvider === 'dev' ? 'demo' : rawProvider;
  const isProduction = isProductionEnvironment(env);

  if (normalizedProvider === 'demo') {
    if (isProduction) {
      return {
        valid: false,
        provider: 'demo',
        missingVars: ['OTP_PROVIDER'],
        error: 'OTP demo mode is never permitted in production. Configure OTP_PROVIDER=twilio or OTP_PROVIDER=msg91 with valid provider credentials.',
      };
    }
    return {
      valid: true,
      provider: 'demo',
      verificationMode: 'development_test',
      providerName: 'Demo / Development Test Mode',
    };
  }

  if (normalizedProvider === 'twilio') {
    const required = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER'] as const;
    const missingVars = required.filter((key) => !hasRealEnvValue(env[key]));
    if (missingVars.length) {
      return { valid: false, provider: 'twilio', missingVars: [...missingVars], error: `OTP_PROVIDER=twilio requires missing environment variable(s): ${missingVars.join(', ')}.` };
    }
    return { valid: true, provider: 'twilio', verificationMode: 'provider', providerName: 'Twilio Programmable SMS' };
  }

  if (normalizedProvider === 'msg91') {
    const required = ['MSG91_AUTH_KEY', 'MSG91_TEMPLATE_ID'] as const;
    const missingVars = required.filter((key) => !hasRealEnvValue(env[key]));
    if (missingVars.length) {
      return { valid: false, provider: 'msg91', missingVars: [...missingVars], error: `OTP_PROVIDER=msg91 requires missing environment variable(s): ${missingVars.join(', ')}.` };
    }
    return { valid: true, provider: 'msg91', verificationMode: 'provider', providerName: 'MSG91 OTP' };
  }

  return {
    valid: false,
    provider: normalizedProvider,
    missingVars: ['OTP_PROVIDER'],
    error: `Unsupported OTP_PROVIDER "${normalizedProvider}". Allowed values: demo, twilio, msg91.`,
  };
}

export function validateStorageEnvironment(
  env: Record<string, string | undefined> = process.env,
): StorageEnvValidationResult {
  const production = isProductionEnvironment(env);
  const hasUrl = hasRealEnvValue(env.SUPABASE_URL);
  const rawSecret = hasRealEnvValue(env.SUPABASE_SECRET_KEY)
    ? env.SUPABASE_SECRET_KEY!.trim()
    : hasRealEnvValue(env.SUPABASE_SERVICE_ROLE_KEY)
      ? env.SUPABASE_SERVICE_ROLE_KEY!.trim()
      : '';
  const hasHmac = hasRealEnvValue(env.PHONE_LOOKUP_HMAC_KEY);
  const hmacKey = hasHmac ? env.PHONE_LOOKUP_HMAC_KEY!.trim() : '';

  if (!hasUrl && !rawSecret) {
    if (production) {
      return {
        valid: false,
        backend: 'supabase_postgres',
        missingVars: ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'PHONE_LOOKUP_HMAC_KEY'],
        error: 'Production requires Supabase registration storage. Local SQLite fallback is disabled in production.',
      };
    }
    if (hasHmac && hmacKey.length < 16) {
      return { valid: false, backend: 'supabase_postgres', missingVars: ['PHONE_LOOKUP_HMAC_KEY'], error: 'PHONE_LOOKUP_HMAC_KEY must be at least 16 characters when configured.' };
    }
    return { valid: true, backend: 'local_sqlite_dev', ...(hasHmac ? { phoneLookupHmacKey: hmacKey } : {}) };
  }

  const missingVars: string[] = [];
  if (!hasUrl) {
    missingVars.push('SUPABASE_URL');
  } else {
    try {
      const parsed = new URL(env.SUPABASE_URL!.trim());
      if (parsed.protocol !== 'https:') {
        return { valid: false, backend: 'supabase_postgres', missingVars: ['SUPABASE_URL'], error: 'SUPABASE_URL must use https://.' };
      }
    } catch {
      return { valid: false, backend: 'supabase_postgres', missingVars: ['SUPABASE_URL'], error: 'SUPABASE_URL is not a valid URL.' };
    }
  }
  if (!rawSecret) missingVars.push('SUPABASE_SECRET_KEY');
  if (!hasHmac || hmacKey.length < 16) missingVars.push('PHONE_LOOKUP_HMAC_KEY');

  if (production) {
    const serverSecret = env.CAN_SERVER_SECRET?.trim() ?? '';
    if (serverSecret.length < 32 || serverSecret.startsWith('MY_')) missingVars.push('CAN_SERVER_SECRET');
    // OTP challenges, sessions, and rate limits still use a local SQLite store.
    // Permit that only on a deliberately configured, single-instance Node host.
    if (env.VERCEL === '1') {
      return {
        valid: false,
        backend: 'supabase_postgres',
        missingVars: ['shared_transient_store'],
        error: 'Vercel/serverless is not supported while OTP challenges, sessions, and rate limits use local SQLite. Configure a shared transient store before deploying there.',
      };
    }
    const sqlitePath = env.CAN_SQLITE_PATH?.trim() ?? '';
    if (env.CAN_ALLOW_PRODUCTION_SQLITE?.trim().toLowerCase() !== 'true' || !path.isAbsolute(sqlitePath)) {
      missingVars.push('CAN_ALLOW_PRODUCTION_SQLITE', 'CAN_SQLITE_PATH');
    }
  }

  if (missingVars.length) {
    return {
      valid: false,
      backend: 'supabase_postgres',
      missingVars: [...new Set(missingVars)],
      error: `Supabase server configuration requires valid environment variable(s): ${[...new Set(missingVars)].join(', ')}.`,
    };
  }

  return {
    valid: true,
    backend: 'supabase_postgres',
    supabaseUrl: env.SUPABASE_URL!.trim().replace(/\/+$/, ''),
    supabaseSecretKey: rawSecret,
    phoneLookupHmacKey: hmacKey,
  };
}
