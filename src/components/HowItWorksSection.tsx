import { ArrowRight } from 'lucide-react';

const STEPS = [
  {
    number: '1',
    title: 'Enter Your Number',
    description:
      'Select your country code (+91 default) and enter your mobile number in the lookup bar.',
  },
  {
    number: '2',
    title: 'Verify Your Ownership',
    description:
      'Complete a one-time code check so registration status is only revealed to the verified owner.',
  },
  {
    number: '3',
    title: 'Activate or Manage Protection',
    description:
      'View your registration state, activate CAN Protection, or deactivate it after confirmation.',
  },
] as const;

export function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="border-b border-[#0C0F13]/10 bg-white py-14 sm:py-16 dark:border-white/10 dark:bg-[#0C0F13]"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center gap-4">
          <div className="h-px flex-1 bg-[#0C0F13]/10 dark:bg-white/10" aria-hidden="true" />
          <h2 className="font-display text-center text-2xl font-bold tracking-tight text-[#0C0F13] sm:text-3xl dark:text-[#F4F1EA]">
            How It Works
          </h2>
          <div className="h-px flex-1 bg-[#0C0F13]/10 dark:bg-white/10" aria-hidden="true" />
        </div>

        <ol className="mt-10 grid gap-6 md:grid-cols-3 md:gap-4 lg:gap-8">
          {STEPS.map((step, index) => (
            <li
              key={step.number}
              className="relative flex flex-col rounded-xl border border-[#0C0F13]/10 bg-[#F4F1EA]/55 p-6 dark:border-white/10 dark:bg-[#141922]"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2F7EF2] font-mono text-sm font-bold text-white">
                    {step.number}
                  </span>
                  <h3 className="font-display text-base font-bold text-[#0C0F13] dark:text-[#F4F1EA]">
                    {step.title}
                  </h3>
                </div>
                {index < STEPS.length - 1 && (
                  <ArrowRight
                    className="hidden h-4 w-4 shrink-0 text-[#2F7EF2] md:block dark:text-[#6FB2FF]"
                    aria-hidden="true"
                  />
                )}
              </div>

              <p className="mt-3 text-sm leading-relaxed text-[#0C0F13]/75 dark:text-[#C3CAD6]">
                {step.description}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
