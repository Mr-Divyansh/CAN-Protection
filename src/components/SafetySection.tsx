import { AlertOctagon, PhoneOff, Shield, Smartphone, UserCheck, VolumeX } from 'lucide-react';

const SAFETY_TOPICS = [
  {
    icon: PhoneOff,
    title: 'Unwanted & Spam Calls',
    detail:
      'Unsolicited promotional or bulk sales calls often cycle through virtual numbers. Avoid engaging or pressing interactive keypad prompts from unknown callers.',
  },
  {
    icon: UserCheck,
    title: 'Fake Caller & Impersonation',
    detail:
      'Caller ID names and numbers can be spoofed. Never share OTPs, bank PINs, or remote-access codes with callers claiming to represent banks, couriers, or agencies.',
  },
  {
    icon: VolumeX,
    title: 'Automated Call Abuse',
    detail:
      'Robocalls and rapid repeated call attempts aim to overwhelm attention or verify active lines. Silence unknown automated callers rather than answering repeatedly.',
  },
  {
    icon: Shield,
    title: 'Safe Call-Handling Practices',
    detail:
      'Hang up immediately if pressured to act urgently. Independently call back the official number printed on your bank card or verified government portal.',
  },
  {
    icon: Smartphone,
    title: 'Device-Level Call Filtering',
    detail:
      'Enable built-in operating system controls: Android Caller ID & Spam Protection in the Phone app, or Silence Unknown Callers in iOS Phone settings.',
  },
  {
    icon: AlertOctagon,
    title: 'Official Reporting Channels',
    detail:
      'Report unsolicited commercial or suspected fraud calls through authorized telecom channels such as TRAI DND (1909) and Sanchar Saathi Chakshu in India, or your national telecom regulator.',
  },
] as const;

export function SafetySection() {
  return (
    <section
      id="safety"
      className="border-b border-[#0C0F13]/10 bg-[#F4F1EA] py-14 sm:py-16 dark:border-white/10 dark:bg-[#0C0F13]"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <h2 className="font-display text-2xl font-bold tracking-tight text-[#0C0F13] sm:text-3xl dark:text-[#F4F1EA]">
            Call Safety Guidance
          </h2>
          <p className="mt-3 text-base leading-relaxed text-[#0C0F13]/75 dark:text-[#C3CAD6]">
            Practical defensive habits and device-level controls to recognize and reduce exposure to
            unwanted, spoofed, or automated calls.
          </p>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SAFETY_TOPICS.map((topic) => {
            const Icon = topic.icon;
            return (
              <article
                key={topic.title}
                className="rounded-xl border border-[#0C0F13]/10 bg-white p-6 transition-colors hover:border-[#2F7EF2]/35 dark:border-white/10 dark:bg-[#141922] dark:hover:border-[#6FB2FF]/35"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2F7EF2]/12 text-[#2F7EF2] dark:bg-[#6FB2FF]/15 dark:text-[#6FB2FF]">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="font-display mt-4 text-base font-bold text-[#0C0F13] dark:text-[#F4F1EA]">
                  {topic.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#0C0F13]/75 dark:text-[#C3CAD6]">
                  {topic.detail}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
