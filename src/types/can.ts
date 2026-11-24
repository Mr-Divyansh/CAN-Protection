export type ThemeMode = 'dark' | 'light';

export type RegistrationStatusValue = 'not_registered' | 'active' | 'inactive';

export interface CountryOption {
  code: string;
  iso: string;
  name: string;
  minLength: number;
  maxLength: number;
  stripLeadingZero: boolean;
  placeholder: string;
}

export interface OtpRequestResponse {
  challengeId: string;
  maskedPhone: string;
  expiresInSeconds: number;
  resendCooldownSeconds: number;
  maxAttempts: number;
  verificationMode: 'development_test' | 'provider';
  providerName: string;
  devTestCode?: string;
}

export interface VerifiedSessionResponse {
  sessionToken: string;
  expiresAt: string;
  maskedPhone: string;
  verificationMode: 'development_test' | 'provider';
}

export interface RegistrationRecordPublic {
  status: RegistrationStatusValue;
  maskedPhone: string;
  verifiedAt: string | null;
  activatedAt: string | null;
  deactivatedAt: string | null;
  updatedAt: string | null;
  storageBackend: 'supabase_postgres' | 'local_sqlite_dev';
}

export interface HealthStatusResponse {
  ok: boolean;
  verificationMode: 'development_test' | 'provider';
  providerName: string;
  storageBackend: 'supabase_postgres' | 'local_sqlite_dev';
}
