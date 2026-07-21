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
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="text-lg font-semibold text-brand-700">GWA Portal</span>
            <nav className="flex gap-4 text-sm">
              {nav.map((item) => (
                <Link key={item.href} href={item.href} className="text-gray-600 hover:text-brand-700">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm">
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
        GWA Credit Portal · Handles personal information under PIPEDA and provincial privacy law.
        Access is logged.
      </footer>
    </div>
  );
}
