import Link from 'next/link';
import type { SessionUser } from '@/lib/session';
import { roleLabel } from '@/lib/rbac';
import { logoutAction } from '@/app/(auth)/actions';

interface NavItem {
  href: string;
  label: string;
}

export function AppShell({
  user,
  nav,
  children,
}: {
  user: SessionUser;
  nav: NavItem[];
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
          <span className="text-lg font-semibold text-brand-700">GWA Dealer Portal</span>
          <div className="order-3 w-full sm:order-2 sm:w-auto sm:flex-1">
            <nav className="-mx-1 flex gap-4 overflow-x-auto px-1 text-sm sm:justify-start">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="whitespace-nowrap py-1 text-gray-600 hover:text-brand-700"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="order-2 flex items-center gap-3 text-sm sm:order-3">
            <div className="text-right">
              <div className="font-medium text-gray-800">{user.name}</div>
              <div className="text-xs text-gray-500">{roleLabel(user.role)}</div>
            </div>
            <form action={logoutAction}>
              <button className="btn-secondary" type="submit">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      <footer className="mx-auto max-w-6xl px-4 py-8 text-xs text-gray-400">
        GWA Dealer Portal · Handles personal information under PIPEDA and provincial privacy law.
        Access is logged.
      </footer>
    </div>
  );
}
