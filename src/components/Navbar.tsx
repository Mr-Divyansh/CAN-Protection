import { Menu, Moon, Sun, X } from 'lucide-react';
import { useState } from 'react';
import type { ThemeMode } from '../types/can.ts';

interface NavbarProps {
  theme: ThemeMode;
  onToggleTheme: () => void;
}

const NAV_LINKS = [
  { href: '#home', label: 'Home' },
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#safety', label: 'Safety' },
  { href: '#about', label: 'About' },
] as const;

export function Navbar({ theme, onToggleTheme }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-[#0C0F13]/10 bg-[#F4F1EA]/90 backdrop-blur-md transition-colors dark:border-white/10 dark:bg-[#0C0F13]/90">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-3.5 sm:px-6 lg:px-8">
        {/* Zone 1: Official CAN Protection Brand */}
        <a
          href="#home"
          className="flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2F7EF2]"
          aria-label="CAN Protection Home"
        >
          <img
            src="/assets/can-shield-logo.png"
            alt=""
            className="h-9 w-9 shrink-0 object-contain"
          />
          <span className="font-display text-lg font-bold tracking-tight whitespace-nowrap text-[#0C0F13] dark:text-[#F4F1EA]">
            <span className="mr-1 text-[#2F7EF2] dark:text-[#6FB2FF]">CAN</span>Protection
          </span>
        </a>

        {/* Zone 2: Primary Navigation Links (Desktop) */}
        <nav
          aria-label="Primary navigation"
          className="hidden items-center gap-8 md:flex"
        >
          {NAV_LINKS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm font-medium whitespace-nowrap shrink-0 text-[#0C0F13]/75 underline-offset-4 transition-colors hover:text-[#2F7EF2] hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2F7EF2] dark:text-[#C3CAD6] dark:hover:text-[#6FB2FF]"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Zone 3: Theme Toggle + Mobile Menu Button */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-pressed={theme === 'dark'}
            className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center gap-2 rounded-lg border border-[#0C0F13]/15 bg-white px-3 py-2 text-xs font-semibold whitespace-nowrap text-[#0C0F13] transition-colors hover:border-[#2F7EF2]/50 hover:text-[#2F7EF2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F7EF2] dark:border-white/15 dark:bg-[#141922] dark:text-[#F4F1EA] dark:hover:border-[#6FB2FF]/50 dark:hover:text-[#6FB2FF]"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="h-4 w-4 text-[#6FB2FF]" aria-hidden="true" />
                <span className="hidden sm:inline">Light Mode</span>
              </>
            ) : (
              <>
                <Moon className="h-4 w-4 text-[#2F7EF2]" aria-hidden="true" />
                <span className="hidden sm:inline">Dark Mode</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav-drawer"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-[#0C0F13]/15 bg-white text-[#0C0F13] transition-colors hover:border-[#2F7EF2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F7EF2] md:hidden dark:border-white/15 dark:bg-[#141922] dark:text-[#F4F1EA]"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <nav
          id="mobile-nav-drawer"
          aria-label="Mobile navigation"
          className="border-t border-[#0C0F13]/10 bg-[#F4F1EA] px-4 py-3 md:hidden dark:border-white/10 dark:bg-[#0C0F13]"
        >
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="flex min-h-[44px] items-center rounded-lg px-3 text-base font-medium text-[#0C0F13] transition-colors hover:bg-[#2F7EF2]/10 hover:text-[#2F7EF2] dark:text-[#F4F1EA] dark:hover:bg-[#6FB2FF]/10 dark:hover:text-[#6FB2FF]"
              >
                {item.label}
              </a>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
