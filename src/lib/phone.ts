import type { CountryOption } from '../types/can.ts';

export const SUPPORTED_COUNTRIES: readonly CountryOption[] = [
  {
    code: '+91',
    iso: 'IN',
    name: 'India',
    minLength: 10,
    maxLength: 10,
    stripLeadingZero: true,
    placeholder: '98765 43210',
  },
  {
    code: '+1',
    iso: 'US',
    name: 'United States / Canada',
    minLength: 10,
    maxLength: 10,
    stripLeadingZero: false,
    placeholder: '415 555 0199',
  },
  {
    code: '+44',
    iso: 'GB',
    name: 'United Kingdom',
    minLength: 10,
    maxLength: 10,
    stripLeadingZero: true,
    placeholder: '7700 900123',
  },
  {
    code: '+61',
    iso: 'AU',
    name: 'Australia',
    minLength: 9,
    maxLength: 9,
    stripLeadingZero: true,
    placeholder: '412 345 678',
  },
  {
    code: '+65',
    iso: 'SG',
    name: 'Singapore',
    minLength: 8,
    maxLength: 8,
    stripLeadingZero: false,
    placeholder: '8123 4567',
  },
  {
    code: '+971',
    iso: 'AE',
    name: 'United Arab Emirates',
    minLength: 9,
    maxLength: 9,
    stripLeadingZero: true,
    placeholder: '50 123 4567',
  },
  {
    code: '+49',
    iso: 'DE',
    name: 'Germany',
    minLength: 10,
    maxLength: 11,
    stripLeadingZero: true,
    placeholder: '151 23456789',
  },
  {
    code: '+81',
    iso: 'JP',
    name: 'Japan',
    minLength: 10,
    maxLength: 10,
    stripLeadingZero: true,
    placeholder: '90 1234 5678',
  },
] as const;

export type PhoneValidationResult =
  | {
      valid: true;
      countryCode: string;
      nationalNumber: string;
      last4: string;
      e164: string;
      masked: string;
    }
  | {
      valid: false;
      error: string;
    };

export function maskPhoneParts(countryCode: string, last4: string): string {
  const safeLast4 = last4.replace(/[^\d]/g, '').slice(-4);
  const country = SUPPORTED_COUNTRIES.find((c) => c.code === countryCode);
  const expectedLength = country?.minLength ?? 10;
  const hiddenCount = Math.max(4, expectedLength - safeLast4.length);
  if (safeLast4.length < 4) {
    return `${countryCode} ••••`;
  }
  return `${countryCode} ${'•'.repeat(hiddenCount)}${safeLast4}`;
}

export function maskNormalizedPhone(e164: string): string {
  const matched = SUPPORTED_COUNTRIES.find((country) => e164.startsWith(country.code));
  const prefix = matched ? matched.code : e164.slice(0, 3);
  const national = matched ? e164.slice(prefix.length) : e164.slice(3);
  if (national.length <= 4) {
    return `${prefix} ••••`;
  }
  const hiddenCount = Math.max(4, national.length - 4);
  return `${prefix} ${'•'.repeat(hiddenCount)}${national.slice(-4)}`;
}

export function normalizeAndValidatePhone(
  rawCountryCode: unknown,
  rawPhoneNumber: unknown,
): PhoneValidationResult {
  if (typeof rawCountryCode !== 'string' || typeof rawPhoneNumber !== 'string') {
    return { valid: false, error: 'Please enter a valid country code and mobile number.' };
  }

  const countryCode = rawCountryCode.trim();
  const country = SUPPORTED_COUNTRIES.find((item) => item.code === countryCode);
  if (!country) {
    return { valid: false, error: 'Selected country code is not supported.' };
  }

  const trimmed = rawPhoneNumber.trim();
  if (!trimmed) {
    return { valid: false, error: 'Please enter your mobile number.' };
  }

  // Reject letters or unexpected symbols right away rather than silently stripping letters.
  if (/[^\d\s().+-]/.test(trimmed)) {
    return {
      valid: false,
      error: 'Mobile number may only contain digits, spaces, hyphens, or parentheses.',
    };
  }

  let digits = trimmed.replace(/[^\d]/g, '');
  const codeDigits = country.code.slice(1);

  if (trimmed.startsWith('+') && digits.startsWith(codeDigits)) {
    digits = digits.slice(codeDigits.length);
  } else if (
    digits.startsWith(codeDigits) &&
    digits.length >= country.minLength + codeDigits.length &&
    digits.length <= country.maxLength + codeDigits.length
  ) {
    digits = digits.slice(codeDigits.length);
  }

  if (country.stripLeadingZero && digits.startsWith('0') && digits.length > country.minLength) {
    digits = digits.slice(1);
  }

  if (digits.length < country.minLength || digits.length > country.maxLength) {
    const lengthLabel =
      country.minLength === country.maxLength
        ? `${country.minLength} digits`
        : `${country.minLength}–${country.maxLength} digits`;
    return {
      valid: false,
      error: `Enter a valid ${lengthLabel} mobile number for ${country.name} (${country.code}).`,
    };
  }

  if (country.code === '+91' && !/^[6-9]\d{9}$/.test(digits)) {
    return {
      valid: false,
      error: 'Indian mobile numbers (+91) must be 10 digits starting with 6, 7, 8, or 9.',
    };
  }

  if (/^0+$/.test(digits)) {
    return { valid: false, error: 'Please enter a valid mobile number.' };
  }

  const e164 = `${country.code}${digits}`;
  const last4 = digits.slice(-4);
  return {
    valid: true,
    countryCode: country.code,
    nationalNumber: digits,
    last4,
    e164,
    masked: maskPhoneParts(country.code, last4),
  };
}
