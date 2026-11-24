import { ArrowRight, ChevronDown, ShieldCheck } from 'lucide-react';
import type { FormEvent } from 'react';
import { SUPPORTED_COUNTRIES } from '../lib/phone.ts';

interface HeroSectionProps {
  countryCode: string;
  phoneNumber: string;
  inputError: string | null;
  isSubmitting: boolean;
  onCountryCodeChange: (value: string) => void;
  onPhoneNumberChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
}

export function HeroSection({
  countryCode,
  phoneNumber,
  inputError,
  isSubmitting,
  onCountryCodeChange,
  onPhoneNumberChange,
  onSubmit,
}: HeroSectionProps) {
  return (
    <section
      id="home"
      className="relative overflow-hidden border-b border-[#0C0F13]/10 bg-white py-12 sm:py-16 lg:py-20 dark:border-white/10 dark:bg-[#0C0F13]"
    >
      {/* Subtle geometric backdrop aura matching reference */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_45%,rgba(47,126,242,0.12),transparent_48%)] dark:bg-[radial-gradient(circle_at_78%_45%,rgba(47,126,242,0.18),transparent_50%)]"
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:gap-12 lg:px-8">
        {/* Left Column: Headline, Description, Number Input Form */}
        <div className="lg:col-span-7">
          <h1 className="font-display text-[clamp(2.25rem,4.5vw,3.5rem)] leading-[1.1] font-extrabold tracking-tight text-balance text-[#0C0F13] dark:text-[#F4F1EA]">
            Take Control of Your{' '}
            <span className="text-[#2F7EF2] dark:text-[#6FB2FF]">Call Safety.</span>
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-[#0C0F13]/75 sm:text-lg dark:text-[#C3CAD6]">
            Protect your mobile number with CAN Protection. Check your registration status and
            manage your number in one place.
          </p>

          <form onSubmit={onSubmit} noValidate className="mt-8 max-w-xl">
            <label
              htmlFor="can-phone-input"
              className="mb-2 block text-sm font-semibold text-[#0C0F13] dark:text-[#F4F1EA]"
            >
              Mobile Number
            </label>

            <div
              className={`flex flex-col gap-2.5 rounded-xl border bg-[#F4F1EA]/70 p-2 transition-colors sm:flex-row sm:items-center sm:gap-2 dark:bg-[#141922] ${
                inputError
                  ? 'border-red-600 dark:border-red-500'
                  : 'border-[#0C0F13]/15 focus-within:border-[#2F7EF2] dark:border-white/15 dark:focus-within:border-[#6FB2FF]'
              }`}
            >
              <div className="relative flex shrink-0 items-center">
                <label htmlFor="can-country-select" className="sr-only">
                  Country code
                </label>
                <select
                  id="can-country-select"
                  value={countryCode}
                  onChange={(e) => onCountryCodeChange(e.target.value)}
                  disabled={isSubmitting}
                  className="min-h-[44px] w-full appearance-none rounded-lg bg-white py-2 pr-8 pl-3 font-mono text-sm font-semibold text-[#0C0F13] focus:outline-none sm:w-auto dark:bg-[#0C0F13] dark:text-[#F4F1EA]"
                >
                  {SUPPORTED_COUNTRIES.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.iso} {country.code}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-2.5 h-4 w-4 text-[#0C0F13]/60 dark:text-[#C3CAD6]"
                  aria-hidden="true"
                />
              </div>

              <input
                id="can-phone-input"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                value={phoneNumber}
                onChange={(e) => onPhoneNumberChange(e.target.value)}
                disabled={isSubmitting}
                placeholder="Enter Mobile Number"
                aria-invalid={Boolean(inputError)}
                aria-describedby={inputError ? 'can-phone-error' : 'can-phone-privacy'}
                className="min-h-[44px] min-w-0 flex-1 rounded-lg bg-transparent px-3 py-2 font-mono text-base text-[#0C0F13] placeholder:font-sans placeholder:text-sm placeholder:text-[#0C0F13]/45 focus:outline-none dark:text-[#F4F1EA] dark:placeholder:text-[#C3CAD6]/50"
              />

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-lg bg-[#2F7EF2] px-5 py-2.5 text-sm font-semibold whitespace-nowrap text-white transition-colors hover:bg-[#2367CC] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F7EF2] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span>{isSubmitting ? 'Sending Code...' : 'Check Protection'}</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {inputError && (
              <p
                id="can-phone-error"
                role="alert"
                className="mt-2.5 text-sm font-medium text-red-700 dark:text-red-400"
              >
                {inputError}
              </p>
            )}

            <p
              id="can-phone-privacy"
              className="mt-3 flex items-center gap-2 text-xs font-medium text-[#0C0F13]/70 sm:text-sm dark:text-[#C3CAD6]"
            >
              <ShieldCheck
                className="h-4 w-4 shrink-0 text-[#2F7EF2] dark:text-[#6FB2FF]"
                aria-hidden="true"
              />
              <span>Your number. Your privacy. Your control.</span>
            </p>
          </form>
        </div>

        {/* Right Column: Official CAN Protection Shield Emblem with Concentric Signal Rings */}
        <div className="flex items-center justify-center lg:col-span-5">
          <div className="relative flex h-64 w-64 items-center justify-center sm:h-80 sm:w-80">
            <div
              aria-hidden="true"
              className="absolute inset-0 rounded-full border border-[#2F7EF2]/15 dark:border-[#6FB2FF]/15"
            />
            <div
              aria-hidden="true"
              className="absolute inset-6 rounded-full border border-[#2F7EF2]/25 dark:border-[#6FB2FF]/20"
            />
            <div
              aria-hidden="true"
              className="absolute inset-12 rounded-full bg-[#2F7EF2]/8 dark:bg-[#2F7EF2]/12"
            />
            <img
              src="/assets/can-shield-logo.png"
              alt="CAN Protection Shield and Mobile Emblem"
              className="relative z-10 h-44 w-44 object-contain drop-shadow-[0_12px_28px_rgba(47,126,242,0.22)] sm:h-56 sm:w-56"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
