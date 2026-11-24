export type LegalTopic = 'privacy' | 'terms' | 'contact';

interface FooterProps {
  onOpenLegal: (topic: LegalTopic) => void;
}

export function Footer({ onOpenLegal }: FooterProps) {
  return (
    <footer className="bg-[#F4F1EA] py-8 dark:bg-[#0C0F13]">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 sm:flex-row sm:items-center sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <img
            src="/assets/can-shield-logo.png"
            alt="CAN Protection"
            className="h-8 w-8 object-contain"
          />
          <div>
            <p className="font-display text-sm font-bold text-[#0C0F13] dark:text-[#F4F1EA]">
              <span className="mr-1 text-[#2F7EF2] dark:text-[#6FB2FF]">CAN</span>Protection
            </p>
            <p className="text-xs text-[#0C0F13]/65 dark:text-[#C3CAD6]/75">
              Protect Yourself. Stay Connected.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-[#0C0F13]/75 dark:text-[#C3CAD6]">
          <button
            type="button"
            onClick={() => onOpenLegal('privacy')}
            className="min-h-[36px] underline-offset-4 hover:text-[#2F7EF2] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F7EF2] dark:hover:text-[#6FB2FF]"
          >
            Privacy Policy
          </button>
          <span aria-hidden="true" className="text-[#0C0F13]/30 dark:text-white/20">
            |
          </span>
          <button
            type="button"
            onClick={() => onOpenLegal('terms')}
            className="min-h-[36px] underline-offset-4 hover:text-[#2F7EF2] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F7EF2] dark:hover:text-[#6FB2FF]"
          >
            Terms of Service
          </button>
          <span aria-hidden="true" className="text-[#0C0F13]/30 dark:text-white/20">
            |
          </span>
          <button
            type="button"
            onClick={() => onOpenLegal('contact')}
            className="min-h-[36px] underline-offset-4 hover:text-[#2F7EF2] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F7EF2] dark:hover:text-[#6FB2FF]"
          >
            Contact Us
          </button>
          <span aria-hidden="true" className="text-[#0C0F13]/30 dark:text-white/20">
            |
          </span>
          <span className="text-[#0C0F13]/60 dark:text-[#C3CAD6]/70">
            © {new Date().getFullYear()} CAN Protection
          </span>
        </div>
      </div>
    </footer>
  );
}
