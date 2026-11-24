import { Check, Info, XCircle } from 'lucide-react';

const SUPPORTED_ITEMS = [
  'Country-aware mobile number formatting and server-side E.164 normalization',
  'Ownership verification before revealing or modifying any registration status',
  'Duplicate-safe activation and confirmed deactivation with server-recorded timestamps',
  'Short-lived verified sessions with rate limiting and replay protection',
] as const;

const NOT_SUPPORTED_ITEMS = [
  'Blocking incoming calls at the telecom carrier or mobile network level',
  'Accessing device call logs, SMS messages, or personal contacts',
  'Public phone-number lookup for numbers you have not verified ownership of',
] as const;

export function AboutSection() {
  return (
    <section
      id="about"
      className="border-b border-[#0C0F13]/10 bg-white py-14 sm:py-16 dark:border-white/10 dark:bg-[#0C0F13]"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-start">
          <div className="lg:col-span-5">
            <h2 className="font-display text-2xl font-bold tracking-tight text-[#0C0F13] sm:text-3xl dark:text-[#F4F1EA]">
              About CAN Protection
            </h2>
            <p className="mt-4 text-base leading-relaxed text-[#0C0F13]/75 dark:text-[#C3CAD6]">
              CAN Protection is a privacy-first mobile-number registration and status-management
              platform built to give individuals a transparent, verified place to manage their
              call-safety registration alongside practical call-handling guidance.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-[#0C0F13]/75 dark:text-[#C3CAD6]">
              Every status lookup or change requires verified number ownership so third parties
              cannot query whether your number is registered or alter your registration state.
            </p>

            <div className="mt-6 rounded-xl border border-[#2F7EF2]/25 bg-[#2F7EF2]/6 p-4 dark:border-[#6FB2FF]/25 dark:bg-[#2F7EF2]/10">
              <div className="flex items-start gap-3">
                <Info
                  className="mt-0.5 h-5 w-5 shrink-0 text-[#2F7EF2] dark:text-[#6FB2FF]"
                  aria-hidden="true"
                />
                <p className="text-xs leading-relaxed text-[#0C0F13]/80 sm:text-sm dark:text-[#C3CAD6]">
                  <strong>Important Technical Boundary:</strong> Registering your number on a
                  website does not automatically block calls at the telecom-network level. Actual
                  call blocking requires authorized carrier or OS-level integration.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:col-span-7">
            <div className="rounded-xl border border-[#0C0F13]/10 bg-[#F4F1EA]/55 p-6 dark:border-white/10 dark:bg-[#141922]">
              <h3 className="font-display text-base font-bold text-[#0C0F13] dark:text-[#F4F1EA]">
                What CAN Protection Supports
              </h3>
              <ul className="mt-4 space-y-3 text-sm text-[#0C0F13]/80 dark:text-[#C3CAD6]">
                {SUPPORTED_ITEMS.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <Check
                      className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400"
                      aria-hidden="true"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-[#0C0F13]/10 bg-[#F4F1EA]/55 p-6 dark:border-white/10 dark:bg-[#141922]">
              <h3 className="font-display text-base font-bold text-[#0C0F13] dark:text-[#F4F1EA]">
                What It Does Not Do
              </h3>
              <ul className="mt-4 space-y-3 text-sm text-[#0C0F13]/80 dark:text-[#C3CAD6]">
                {NOT_SUPPORTED_ITEMS.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <XCircle
                      className="mt-0.5 h-4 w-4 shrink-0 text-[#0C0F13]/55 dark:text-[#C3CAD6]/70"
                      aria-hidden="true"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
