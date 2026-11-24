import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Info,
  KeyRound,
  Lock,
  LogOut,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import type {
  OtpRequestResponse,
  RegistrationRecordPublic,
  VerifiedSessionResponse,
} from '../types/can.ts';

interface ProtectionPortalProps {
  challenge: OtpRequestResponse | null;
  session: VerifiedSessionResponse | null;
  registration: RegistrationRecordPublic | null;
  portalError: string | null;
  actionFeedback: string | null;
  isBusy: boolean;
  onVerifyOtp: (code: string) => Promise<void>;
  onResendOtp: () => Promise<void>;
  onActivate: () => Promise<void>;
  onConfirmDeactivate: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onResetFlow: () => void;
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return 'Not recorded';
  try {
    return new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function ProtectionPortal({
  challenge,
  session,
  registration,
  portalError,
  actionFeedback,
  isBusy,
  onVerifyOtp,
  onResendOtp,
  onActivate,
  onConfirmDeactivate,
  onSignOut,
  onResetFlow,
}: ProtectionPortalProps) {
  const [otpInput, setOtpInput] = useState('');
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [showManageDetails, setShowManageDetails] = useState(false);
  const [showUnprotectDialog, setShowUnprotectDialog] = useState(false);

  useEffect(() => {
    if (!challenge) {
      setOtpInput('');
      setCooldownLeft(0);
      return;
    }
    setOtpInput('');
    setCooldownLeft(challenge.resendCooldownSeconds);
  }, [challenge]);

  useEffect(() => {
    if (cooldownLeft <= 0) return;
    const timer = window.setInterval(() => {
      setCooldownLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownLeft]);

  const handleOtpSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await onVerifyOtp(otpInput);
  };

  // Unverified idle overview (preserves privacy; displays exact state preview without leaking records)
  if (!challenge && !session) {
    return (
      <section
        aria-label="Protection Status Overview"
        className="border-b border-[#0C0F13]/10 bg-[#F4F1EA] py-10 sm:py-12 dark:border-white/10 dark:bg-[#0C0F13]"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-lg font-bold text-[#0C0F13] dark:text-[#F4F1EA]">
                Verification-Gated Status Management
              </h2>
              <p className="text-sm text-[#0C0F13]/70 dark:text-[#C3CAD6]">
                Enter your mobile number above and verify ownership via OTP to view or change your
                CAN Protection registration state.
              </p>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {/* Preview State A */}
            <div className="flex flex-col justify-between rounded-xl border border-emerald-600/25 bg-white p-6 dark:border-emerald-500/30 dark:bg-[#111920]">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-600/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                  <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-display text-base font-bold text-[#0C0F13] dark:text-[#F4F1EA]">
                    Your Number Is Protected
                  </h3>
                  <p className="mt-1 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                    Status: Active
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-[#0C0F13]/70 dark:text-[#C3CAD6]">
                    Shown after ownership verification when your mobile number holds an active CAN
                    Protection registration.
                  </p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-3 text-xs font-medium text-[#0C0F13]/65 dark:text-[#C3CAD6]">
                <span>Manage Protection</span>
                <span aria-hidden="true">·</span>
                <span>Confirmed Deactivation</span>
              </div>
            </div>

            {/* Preview State B */}
            <div className="flex flex-col justify-between rounded-xl border border-[#0C0F13]/15 bg-white p-6 dark:border-white/15 dark:bg-[#141922]">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#2F7EF2]/12 text-[#2F7EF2] dark:bg-[#6FB2FF]/15 dark:text-[#6FB2FF]">
                  <AlertTriangle className="h-6 w-6" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-display text-base font-bold text-[#0C0F13] dark:text-[#F4F1EA]">
                    Your Number Is Not Protected Yet
                  </h3>
                  <p className="mt-1 text-sm font-semibold text-[#0C0F13]/80 dark:text-[#C3CAD6]">
                    Status: Not Registered
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-[#0C0F13]/70 dark:text-[#C3CAD6]">
                    Shown after verification if your number is unregistered or inactive, allowing
                    you to activate CAN Protection registration.
                  </p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-3 text-xs font-medium text-[#0C0F13]/65 dark:text-[#C3CAD6]">
                <span>Duplicate-Safe Activation</span>
                <span aria-hidden="true">·</span>
                <span>Server-Enforced Access</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Step 2: OTP Ownership Verification Panel
  if (challenge && !session) {
    return (
      <section
        id="verification-panel"
        aria-label="Verify Mobile Number Ownership"
        className="border-b border-[#0C0F13]/10 bg-[#F4F1EA] py-10 sm:py-12 dark:border-white/10 dark:bg-[#0C0F13]"
      >
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-[#0C0F13]/15 bg-white p-6 sm:p-8 dark:border-white/15 dark:bg-[#141922]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#2F7EF2]/12 text-[#2F7EF2] dark:bg-[#6FB2FF]/15 dark:text-[#6FB2FF]">
                  <KeyRound className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="font-display text-xl font-bold text-[#0C0F13] dark:text-[#F4F1EA]">
                    Verify Your Ownership
                  </h2>
                  <p className="mt-1 text-sm text-[#0C0F13]/75 dark:text-[#C3CAD6]">
                    Enter the 6-digit verification code for{' '}
                    <span className="font-mono font-semibold text-[#0C0F13] dark:text-[#F4F1EA]">
                      {challenge.maskedPhone}
                    </span>
                    .
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onResetFlow}
                className="min-h-[40px] rounded-lg border border-[#0C0F13]/15 px-3 py-1.5 text-xs font-semibold text-[#0C0F13]/80 transition-colors hover:border-[#2F7EF2] hover:text-[#2F7EF2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F7EF2] dark:border-white/15 dark:text-[#C3CAD6] dark:hover:border-[#6FB2FF] dark:hover:text-[#6FB2FF]"
              >
                Change Number
              </button>
            </div>

            {challenge.verificationMode === 'development_test' && challenge.devTestCode && (
              <div
                role="status"
                className="mt-5 rounded-xl border border-[#2F7EF2]/35 bg-[#2F7EF2]/8 p-4 dark:border-[#6FB2FF]/35 dark:bg-[#2F7EF2]/15"
              >
                <div className="flex items-start gap-3">
                  <Info
                    className="mt-0.5 h-5 w-5 shrink-0 text-[#2F7EF2] dark:text-[#6FB2FF]"
                    aria-hidden="true"
                  />
                  <div className="text-sm">
                    <p className="font-semibold text-[#0C0F13] dark:text-[#F4F1EA]">
                      Development Test Mode Active — Simulated Verification Code
                    </p>
                    <p className="mt-1 text-[#0C0F13]/80 dark:text-[#C3CAD6]">
                      No live SMS provider is configured in this environment. Use test code{' '}
                      <strong
                        data-testid="dev-test-otp"
                        className="font-mono text-base tracking-wider text-[#2F7EF2] dark:text-[#6FB2FF]"
                      >
                        {challenge.devTestCode}
                      </strong>{' '}
                      to complete verification. This test flow is not production telecom SMS
                      delivery.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleOtpSubmit} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="can-otp-input"
                  className="mb-2 block text-sm font-semibold text-[#0C0F13] dark:text-[#F4F1EA]"
                >
                  6-Digit Verification Code
                </label>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    id="can-otp-input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                    placeholder="Enter 6-digit code"
                    disabled={isBusy}
                    className="min-h-[46px] flex-1 rounded-lg border border-[#0C0F13]/20 bg-[#F4F1EA]/50 px-4 py-2.5 font-mono text-lg tracking-[0.25em] text-[#0C0F13] focus:border-[#2F7EF2] focus:outline-none dark:border-white/20 dark:bg-[#0C0F13] dark:text-[#F4F1EA] dark:focus:border-[#6FB2FF]"
                  />
                  <button
                    type="submit"
                    disabled={isBusy || otpInput.length !== 6}
                    className="inline-flex min-h-[46px] shrink-0 items-center justify-center gap-2 rounded-lg bg-[#2F7EF2] px-6 py-2.5 text-sm font-semibold whitespace-nowrap text-white transition-colors hover:bg-[#2367CC] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F7EF2] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Lock className="h-4 w-4" aria-hidden="true" />
                    <span>{isBusy ? 'Verifying...' : 'Verify Ownership'}</span>
                  </button>
                </div>
              </div>

              {portalError && (
                <p
                  role="alert"
                  className="rounded-lg border border-red-600/30 bg-red-600/10 px-4 py-2.5 text-sm font-medium text-red-700 dark:border-red-500/35 dark:bg-red-500/15 dark:text-red-300"
                >
                  {portalError}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#0C0F13]/10 pt-4 text-xs text-[#0C0F13]/70 dark:border-white/10 dark:text-[#C3CAD6]">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>
                    Code expires in {Math.floor(challenge.expiresInSeconds / 60)} min · Max{' '}
                    {challenge.maxAttempts} attempts
                  </span>
                </span>

                <button
                  type="button"
                  disabled={isBusy || cooldownLeft > 0}
                  onClick={onResendOtp}
                  className="inline-flex min-h-[36px] items-center gap-1.5 font-semibold text-[#2F7EF2] transition-colors hover:underline disabled:cursor-not-allowed disabled:opacity-50 dark:text-[#6FB2FF]"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>
                    {cooldownLeft > 0 ? `Resend available in ${cooldownLeft}s` : 'Resend Code'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>
    );
  }

  // Step 3: Verified Protection Status Management (State A or State B)
  const isActive = registration?.status === 'active';
  const isInactive = registration?.status === 'inactive';

  return (
    <section
      id="status-panel"
      aria-label="Verified Protection Status"
      className="border-b border-[#0C0F13]/10 bg-[#F4F1EA] py-10 sm:py-12 dark:border-white/10 dark:bg-[#0C0F13]"
    >
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div
          className={`rounded-xl border p-6 sm:p-8 ${
            isActive
              ? 'border-emerald-600/35 bg-white dark:border-emerald-500/40 dark:bg-[#0E1A16]'
              : 'border-[#0C0F13]/15 bg-white dark:border-white/15 dark:bg-[#141922]'
          }`}
        >
          {/* Header row */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              {isActive ? (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-600/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                  <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
                </div>
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#2F7EF2]/12 text-[#2F7EF2] dark:bg-[#6FB2FF]/15 dark:text-[#6FB2FF]">
                  <AlertTriangle className="h-7 w-7" aria-hidden="true" />
                </div>
              )}

              <div>
                <h2 className="font-display text-xl font-bold text-[#0C0F13] sm:text-2xl dark:text-[#F4F1EA]">
                  {isActive ? 'Your Number Is Protected' : 'Your Number Is Not Protected Yet'}
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                  <span
                    className={`font-semibold ${
                      isActive
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-[#0C0F13]/85 dark:text-[#C3CAD6]'
                    }`}
                  >
                    Status: {isActive ? 'Active' : isInactive ? 'Inactive' : 'Not Registered'}
                  </span>
                  <span aria-hidden="true" className="text-[#0C0F13]/40 dark:text-[#C3CAD6]/40">
                    ·
                  </span>
                  <span className="font-mono text-[#0C0F13]/80 dark:text-[#C3CAD6]">
                    {registration?.maskedPhone ?? session?.maskedPhone}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onSignOut}
              disabled={isBusy}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#0C0F13]/15 px-3.5 py-2 text-xs font-semibold text-[#0C0F13]/80 transition-colors hover:border-[#2F7EF2] hover:text-[#2F7EF2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F7EF2] dark:border-white/15 dark:text-[#C3CAD6] dark:hover:border-[#6FB2FF] dark:hover:text-[#6FB2FF]"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Lock Session</span>
            </button>
          </div>

          {/* Honest scope clarification */}
          <p className="mt-4 text-sm leading-relaxed text-[#0C0F13]/75 dark:text-[#C3CAD6]">
            {isActive
              ? 'Your mobile number currently has an active CAN Protection platform registration. Note: CAN Protection tracks verified registration status and does not independently block calls at the telecom network level.'
              : 'Activate protection to create or restore your verified CAN Protection platform registration. Note: Platform registration records your protection status and does not independently block incoming telecom calls.'}
          </p>

          {actionFeedback && (
            <div
              role="status"
              className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-600/30 bg-emerald-600/10 px-4 py-2.5 text-sm font-medium text-emerald-800 dark:border-emerald-500/35 dark:bg-emerald-500/15 dark:text-emerald-300"
            >
              <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{actionFeedback}</span>
            </div>
          )}

          {portalError && (
            <div
              role="alert"
              className="mt-4 rounded-lg border border-red-600/30 bg-red-600/10 px-4 py-2.5 text-sm font-medium text-red-700 dark:border-red-500/35 dark:bg-red-500/15 dark:text-red-300"
            >
              {portalError}
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {isActive ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowManageDetails((prev) => !prev)}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#2F7EF2] px-5 py-2.5 text-sm font-semibold whitespace-nowrap text-white transition-colors hover:bg-[#2367CC] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F7EF2]"
                >
                  {showManageDetails ? 'Hide Details' : 'Manage Protection'}
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => setShowUnprotectDialog(true)}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-[#0C0F13]/20 bg-transparent px-5 py-2.5 text-sm font-semibold whitespace-nowrap text-[#0C0F13] transition-colors hover:border-red-600 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:opacity-50 dark:border-white/25 dark:text-[#F4F1EA] dark:hover:border-red-400 dark:hover:text-red-300"
                >
                  Unprotect
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={isBusy}
                onClick={onActivate}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[#2F7EF2] px-6 py-2.5 text-sm font-semibold whitespace-nowrap text-white transition-colors hover:bg-[#2367CC] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F7EF2] disabled:opacity-50"
              >
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                <span>{isBusy ? 'Activating...' : 'Activate Protection'}</span>
              </button>
            )}
          </div>

          {/* Registration Timestamps & Manage Details */}
          {(showManageDetails || !isActive) && registration && (
            <dl className="mt-6 grid gap-4 border-t border-[#0C0F13]/10 pt-5 text-xs sm:grid-cols-3 dark:border-white/10">
              <div>
                <dt className="font-medium text-[#0C0F13]/60 dark:text-[#C3CAD6]/70">
                  Ownership Verified
                </dt>
                <dd className="mt-1 font-mono font-medium text-[#0C0F13] dark:text-[#F4F1EA]">
                  {formatTimestamp(registration.verifiedAt)}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-[#0C0F13]/60 dark:text-[#C3CAD6]/70">
                  Latest Activation
                </dt>
                <dd className="mt-1 font-mono font-medium text-[#0C0F13] dark:text-[#F4F1EA]">
                  {formatTimestamp(registration.activatedAt)}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-[#0C0F13]/60 dark:text-[#C3CAD6]/70">
                  {registration.deactivatedAt ? 'Latest Deactivation' : 'Session Expires'}
                </dt>
                <dd className="mt-1 font-mono font-medium text-[#0C0F13] dark:text-[#F4F1EA]">
                  {registration.deactivatedAt
                    ? formatTimestamp(registration.deactivatedAt)
                    : formatTimestamp(session?.expiresAt ?? null)}
                </dd>
              </div>
            </dl>
          )}
        </div>
      </div>

      {/* Explicit Confirmation Dialog for Unprotect / Deactivate */}
      {showUnprotectDialog && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="unprotect-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0C0F13]/75 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-xl border border-[#0C0F13]/15 bg-white p-6 shadow-xl dark:border-white/15 dark:bg-[#141922]">
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2F7EF2]/12 text-[#2F7EF2] dark:bg-[#6FB2FF]/15 dark:text-[#6FB2FF]">
                <ShieldAlert className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h3
                  id="unprotect-dialog-title"
                  className="font-display text-lg font-bold text-[#0C0F13] dark:text-[#F4F1EA]"
                >
                  Confirm Deactivation
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#0C0F13]/75 dark:text-[#C3CAD6]">
                  Deactivating marks your CAN Protection registration for{' '}
                  <span className="font-mono font-semibold text-[#0C0F13] dark:text-[#F4F1EA]">
                    {registration?.maskedPhone ?? session?.maskedPhone}
                  </span>{' '}
                  as <strong>Inactive</strong> and records a deactivation timestamp. You can
                  reactivate your registration anytime after verifying ownership.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowUnprotectDialog(false)}
                disabled={isBusy}
                className="min-h-[44px] rounded-lg border border-[#0C0F13]/20 px-4 py-2 text-sm font-semibold text-[#0C0F13] transition-colors hover:bg-[#0C0F13]/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F7EF2] dark:border-white/20 dark:text-[#F4F1EA] dark:hover:bg-white/5"
              >
                Keep Protection Active
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={async () => {
                  await onConfirmDeactivate();
                  setShowUnprotectDialog(false);
                }}
                className="min-h-[44px] rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:opacity-50"
              >
                {isBusy ? 'Deactivating...' : 'Confirm Unprotect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
