import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AboutSection } from './components/AboutSection.tsx';
import { Footer, type LegalTopic } from './components/Footer.tsx';
import { HeroSection } from './components/HeroSection.tsx';
import { HowItWorksSection } from './components/HowItWorksSection.tsx';
import { LegalModal } from './components/LegalModal.tsx';
import { Navbar } from './components/Navbar.tsx';
import { ProtectionPortal } from './components/ProtectionPortal.tsx';
import { SafetySection } from './components/SafetySection.tsx';
import { normalizeAndValidatePhone } from './lib/phone.ts';
import type {
  OtpRequestResponse,
  RegistrationRecordPublic,
  ThemeMode,
  VerifiedSessionResponse,
} from './types/can.ts';

function readInitialTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem('can_protection_theme');
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
  } catch {
    // Ignore storage read errors
  }
  return 'dark';
}

export default function App() {
  const [theme, setTheme] = useState<ThemeMode>(readInitialTheme);
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);

  const [challenge, setChallenge] = useState<OtpRequestResponse | null>(null);
  const [session, setSession] = useState<VerifiedSessionResponse | null>(null);
  const [registration, setRegistration] = useState<RegistrationRecordPublic | null>(null);

  const [portalError, setPortalError] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [legalTopic, setLegalTopic] = useState<LegalTopic | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('can_protection_theme', theme);
    } catch {
      // Ignore storage write errors
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const requestOtpForNumber = useCallback(
    async (code: string, number: string) => {
      const localCheck = normalizeAndValidatePhone(code, number);
      if (!localCheck.valid) {
        setInputError(localCheck.error);
        return;
      }

      setInputError(null);
      setPortalError(null);
      setActionFeedback(null);
      setIsBusy(true);

      try {
        const response = await fetch('/api/otp/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ countryCode: code, phoneNumber: number }),
        });

        const data = (await response.json()) as OtpRequestResponse & { error?: string };
        if (!response.ok) {
          const message = data.error ?? 'Unable to request verification code.';
          if (challenge) {
            setPortalError(message);
          } else {
            setInputError(message);
          }
          return;
        }

        setSession(null);
        setRegistration(null);
        setChallenge(data);
        window.setTimeout(() => {
          document.getElementById('verification-panel')?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
          });
        }, 60);
      } catch {
        setInputError('Network error while contacting verification service.');
      } finally {
        setIsBusy(false);
      }
    },
    [challenge],
  );

  const handleHeroSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await requestOtpForNumber(countryCode, phoneNumber);
  };

  const fetchRegistrationStatus = useCallback(async (token: string) => {
    const statusRes = await fetch('/api/registration/status', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const statusData = (await statusRes.json()) as RegistrationRecordPublic & { error?: string };
    if (!statusRes.ok) {
      throw new Error(statusData.error ?? 'Failed to retrieve registration status.');
    }
    setRegistration(statusData);
  }, []);

  const handleVerifyOtp = async (code: string) => {
    if (!challenge) return;
    setPortalError(null);
    setActionFeedback(null);
    setIsBusy(true);

    try {
      const verifyRes = await fetch('/api/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId: challenge.challengeId, code }),
      });

      const verifyData = (await verifyRes.json()) as VerifiedSessionResponse & { error?: string };
      if (!verifyRes.ok) {
        setPortalError(verifyData.error ?? 'Verification failed. Please check the code.');
        return;
      }

      setSession(verifyData);
      setChallenge(null);
      await fetchRegistrationStatus(verifyData.sessionToken);
    } catch (err) {
      setPortalError(
        err instanceof Error ? err.message : 'Unable to complete verification right now.',
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleActivate = async () => {
    if (!session) return;
    setPortalError(null);
    setActionFeedback(null);
    setIsBusy(true);

    try {
      const res = await fetch('/api/registration/activate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.sessionToken}`,
          'Content-Type': 'application/json',
        },
      });
      const data = (await res.json()) as RegistrationRecordPublic & { error?: string };
      if (!res.ok) {
        if (res.status === 401) {
          setSession(null);
          setRegistration(null);
        }
        setPortalError(data.error ?? 'Unable to activate CAN Protection.');
        return;
      }
      setRegistration(data);
      setActionFeedback('CAN Protection registration is now Active for your verified number.');
    } catch {
      setPortalError('Network error while activating protection.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleConfirmDeactivate = async () => {
    if (!session) return;
    setPortalError(null);
    setActionFeedback(null);
    setIsBusy(true);

    try {
      const res = await fetch('/api/registration/deactivate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.sessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ confirm: true }),
      });
      const data = (await res.json()) as RegistrationRecordPublic & { error?: string };
      if (!res.ok) {
        if (res.status === 401) {
          setSession(null);
          setRegistration(null);
        }
        setPortalError(data.error ?? 'Unable to deactivate CAN Protection.');
        return;
      }
      setRegistration(data);
      setActionFeedback('CAN Protection registration has been deactivated.');
    } catch {
      setPortalError('Network error while deactivating protection.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleSignOut = async () => {
    if (!session) return;
    setIsBusy(true);
    try {
      await fetch('/api/session/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.sessionToken}` },
      });
    } finally {
      setSession(null);
      setRegistration(null);
      setChallenge(null);
      setPortalError(null);
      setActionFeedback(null);
      setIsBusy(false);
    }
  };

  const handleResetFlow = () => {
    setChallenge(null);
    setSession(null);
    setRegistration(null);
    setPortalError(null);
    setActionFeedback(null);
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F4F1EA] text-[#0C0F13] transition-colors dark:bg-[#0C0F13] dark:text-[#F4F1EA]">
      <Navbar theme={theme} onToggleTheme={toggleTheme} />

      <main className="flex-1">
        <HeroSection
          countryCode={countryCode}
          phoneNumber={phoneNumber}
          inputError={inputError}
          isSubmitting={isBusy}
          onCountryCodeChange={(val) => {
            setCountryCode(val);
            setInputError(null);
          }}
          onPhoneNumberChange={(val) => {
            setPhoneNumber(val);
            if (inputError) setInputError(null);
          }}
          onSubmit={handleHeroSubmit}
        />

        <ProtectionPortal
          challenge={challenge}
          session={session}
          registration={registration}
          portalError={portalError}
          actionFeedback={actionFeedback}
          isBusy={isBusy}
          onVerifyOtp={handleVerifyOtp}
          onResendOtp={() => requestOtpForNumber(countryCode, phoneNumber)}
          onActivate={handleActivate}
          onConfirmDeactivate={handleConfirmDeactivate}
          onSignOut={handleSignOut}
          onResetFlow={handleResetFlow}
        />

        <HowItWorksSection />
        <SafetySection />
        <AboutSection />
      </main>

      <Footer onOpenLegal={setLegalTopic} />
      <LegalModal topic={legalTopic} onClose={() => setLegalTopic(null)} />
    </div>
  );
}
