'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { logoutAction } from '@/app/(auth)/actions';
import { ThemeToggle } from '@/components/ThemeToggle';

interface NavItem {
  href: string;
  label: string;
}

/**
 * Mobile navigation: a hamburger button that opens a slide-in drawer with the
 * nav links, the portal switcher, the theme toggle, and sign out. Shown only
 * below the `sm` breakpoint; the full top bar takes over on larger screens.
 */
export function MobileNav({
  userName,
  roleLabel,
  nav,
  portal,
  showSwitcher,
}: {
  userName: string;
  roleLabel: string;
  nav: NavItem[];
  portal?: 'dealer' | 'staff' | 'admin';
  showSwitcher: boolean;
}) {
  const [open, setOpen] = useState(false);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const switchBase = 'rounded-full px-3 py-1 text-sm font-medium';

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
          <nav className="drawer-in absolute right-0 top-0 flex h-full w-72 max-w-[85%] flex-col bg-white shadow-xl">
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

            {showSwitcher && (
              <div className="border-b border-gray-100 p-4">
                <div className="flex items-center gap-1 rounded-full bg-gray-100 p-0.5">
                  <Link href="/dealer" onClick={() => setOpen(false)} className={`${switchBase} flex-1 text-center ${portal === 'dealer' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500'}`}>
                    Dealer view
                  </Link>
                  <Link href="/staff" onClick={() => setOpen(false)} className={`${switchBase} flex-1 text-center ${portal === 'staff' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500'}`}>
                    Reviewer view
                  </Link>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-2">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-3 py-3 text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-brand-700"
                >
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
