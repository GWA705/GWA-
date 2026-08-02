'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { logoutAction } from '@/app/(auth)/actions';
import { ThemeToggle } from '@/components/ThemeToggle';

interface NavItem {
  href: string;
  label: string;
}

// A small line-icon chosen by matching keywords in the link label, so the same
// component works across the dealer, reviewer, and admin menus. Falls back to a
// neutral dot. Icons are inline SVG paths (no dependency).
function iconPath(label: string): string {
  const l = label.toLowerCase();
  if (l.includes('overview') || l.includes('dashboard')) return 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z';
  if (l.includes('applic') || l.includes('deal') || l.includes('queue') || l.includes('loan')) return 'M4 6h16M4 12h16M4 18h10';
  if (l.includes('new customer')) return 'M12 5v14M5 12h14';
  if (l.includes('resource') || l.includes('content')) return 'M6 3h9l5 5v13H6zM15 3v5h5';
  if (l.includes('promotion') || l.includes('advertis') || l.includes('sign') || l.includes('banner')) return 'M3 11l14-6v14L3 13zM3 11v2M17 9a3 3 0 0 1 0 6';
  if (l.includes('account')) return 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20c0-4 4-6 8-6s8 2 8 6';
  if (l.includes('user')) return 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 20c0-3.5 3-5 7-5M17 11l2 2 3-3';
  if (l.includes('dealer')) return 'M4 9l1-4h14l1 4M4 9v11h16V9M4 9h16M9 20v-6h6v6';
  if (l.includes('finance')) return 'M3 10l9-5 9 5M5 10v9h14v-9M9 19v-5m6 5v-5';
  if (l.includes('product')) return 'M12 3l8 4v10l-8 4-8-4V7zM4 7l8 4 8-4M12 11v10';
  if (l.includes('reminder') || l.includes('alert') || l.includes('pop-up')) return 'M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6M10 20a2 2 0 0 0 4 0';
  if (l.includes('note') || l.includes('quick')) return 'M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z';
  if (l.includes('audit')) return 'M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6zM9 12l2 2 4-4';
  if (l.includes('security')) return 'M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6zM12 11v4M12 8v.5';
  if (l.includes('email')) return 'M3 6h18v12H3zM3 7l9 6 9-6';
  return 'M9 6l6 6-6 6';
}

function NavIcon({ label }: { label: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-gray-400" aria-hidden>
      <path d={iconPath(label)} />
    </svg>
  );
}

/**
 * Mobile navigation: a hamburger button (top-left) that opens a left slide-in
 * drawer with the nav links (each with an icon), the portal switcher, the theme
 * toggle, and sign out. Shown only below the `sm` breakpoint; the full top bar
 * takes over on larger screens.
 */
export function MobileNav({
  userName,
  roleLabel,
  nav,
}: {
  userName: string;
  roleLabel: string;
  nav: NavItem[];
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="sm:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="btn-secondary px-2.5"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-hidden />
          <nav className="drawer-in absolute left-0 top-0 flex h-full w-72 max-w-[85%] flex-col bg-white shadow-xl">
            {/* Header: who's signed in + close */}
            <div className="flex items-start justify-between border-b border-gray-200 p-4">
              <div>
                <div className="font-semibold text-gray-900">{userName}</div>
                <div className="text-xs text-gray-500">{roleLabel}</div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="btn-secondary px-2.5"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="18" y1="6" x2="6" y2="18" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-md px-3 py-3 text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-brand-700"
                >
                  <NavIcon label={item.label} />
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-gray-200 p-4">
              <ThemeToggle />
              <form action={logoutAction}>
                <button className="btn-secondary" type="submit">
                  Sign out
                </button>
              </form>
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}
