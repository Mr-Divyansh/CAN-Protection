import { X } from 'lucide-react';
import type { LegalTopic } from './Footer.tsx';

interface LegalModalProps {
  topic: LegalTopic | null;
  onClose: () => void;
}

export function LegalModal({ topic, onClose }: LegalModalProps) {
  if (!topic) return null;

  const content = {
    privacy: {
      title: 'Privacy Policy (Draft — Pending Owner & Legal Review)',
      sections: [
        {
          heading: 'Data Processed',
          body: 'CAN Protection normalizes your mobile number in memory for OTP verification and stores only a keyed cryptographic hash, country code, and last 4 digits (never the raw phone number in the registration database), along with verification timestamps and registration state (active/inactive).',
        },
        {
          heading: 'Security Controls',
          body: 'Verification codes and session tokens are stored strictly as HMAC-SHA256 hashes (never plaintext) and expire automatically. Registration status is never disclosed before mobile-number ownership is verified.',
        },
        {
          heading: 'Pending Confirmation Items',
          body: 'Data retention duration, formal deletion request channel, and final OTP vendor disclosure require confirmation from the project owner and legal review prior to public production launch (see PRIVACY-POLICY.md).',
        },
      ],
    },
    terms: {
      title: 'Terms of Service (Draft — Pending Owner & Legal Review)',
      sections: [
        {
          heading: 'Service Scope & Limitation',
          body: 'CAN Protection provides mobile-number ownership verification and platform registration status management. Registration in CAN Protection does not independently block incoming calls at the telecom-network level or guarantee protection against spam or fraudulent calls.',
        },
        {
          heading: 'Permitted Use',
          body: 'You may only verify and manage mobile numbers that you own or are authorized to control. Automated probing, enumeration, or repeated verification abuse is strictly prohibited and rate-limited.',
        },
        {
          heading: 'Pending Confirmation Items',
          body: 'Governing jurisdiction, operator entity details, and formal dispute contact information require confirmation before public release (see TERMS.md).',
        },
      ],
    },
    contact: {
      title: 'Contact Information (Pending Owner Confirmation)',
      sections: [
        {
          heading: 'Official Support Channel',
          body: 'An official support email address or contact channel has not yet been published by the project owner. No placeholder or unverified email address is shown here.',
        },
        {
          heading: 'Project Maintainer Setup',
          body: 'Once the project owner supplies an official support channel, update CONTACT.md and this dialog before launching to public users.',
        },
      ],
    },
  }[topic];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0C0F13]/75 p-4 backdrop-blur-xs"
    >
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[#0C0F13]/15 bg-white p-6 shadow-xl dark:border-white/15 dark:bg-[#141922]">
        <div className="flex items-start justify-between gap-4 border-b border-[#0C0F13]/10 pb-4 dark:border-white/10">
          <h2
            id="legal-modal-title"
            className="font-display text-lg font-bold text-[#0C0F13] dark:text-[#F4F1EA]"
          >
            {content.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#0C0F13]/15 text-[#0C0F13] transition-colors hover:border-[#2F7EF2] hover:text-[#2F7EF2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F7EF2] dark:border-white/15 dark:text-[#F4F1EA]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {content.sections.map((section) => (
            <div key={section.heading}>
              <h3 className="font-display text-sm font-bold text-[#0C0F13] dark:text-[#F4F1EA]">
                {section.heading}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-[#0C0F13]/75 dark:text-[#C3CAD6]">
                {section.body}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end border-t border-[#0C0F13]/10 pt-4 dark:border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] rounded-lg bg-[#2F7EF2] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2367CC] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F7EF2]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
