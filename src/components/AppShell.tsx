import Link from 'next/link';
import { hasBothPortals, type SessionUser } from '@/lib/session';
import { roleLabel } from '@/lib/rbac';
import { logoutAction } from '@/app/(auth)/actions';
import { ThemeToggle } from '@/components/ThemeToggle';
import { MobileNav } from '@/components/MobileNav';

interface NavItem {
  href: string;
  label: string;
}

// Switcher shown to users who can use both portals (an internal user linked to
// a dealer): jump between the dealer view and the reviewer view with one login.
function PortalSwitcher({ current }: { current: 'dealer' | 'staff' }) {
  const base = 'rounded-full px-3 py-1 text-xs font-medium';
  return (
    <div className="flex items-center gap-1 rounded-full bg-gray-100 p-0.5">
      <Link href="/dealer" className={`${base} ${current === 'dealer' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
        Dealer view
      </Link>
      <Link href="/staff" className={`${base} ${current === 'staff' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
        Reviewer view
      </Link>
    </div>
  );
}

export function AppShell({
  user,
  nav,
  portal,
  children,
}: {
  user: SessionUser;
  nav: NavItem[];
  portal?: 'dealer' | 'staff' | 'admin';
  children: React.ReactNode;
}) {
  const showSwitcher = hasBothPortals(user) && (portal === 'dealer' || portal === 'staff');
  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:flex-wrap">
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold text-brand-700">GWA Dealer Portal</span>
            {showSwitcher && (
              <div className="hidden sm:block">
                <PortalSwitcher current={portal as 'dealer' | 'staff'} />
              </div>
            )}
          </div>

          {/* Desktop / tablet: full nav + account cluster */}
          <div className="order-3 hidden w-full sm:order-2 sm:block sm:w-auto sm:flex-1">
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
          <div className="order-2 hidden items-center gap-3 text-sm sm:order-3 sm:flex">
            <div className="text-right">
              <div className="font-medium text-gray-800">{user.name}</div>
              <div className="text-xs text-gray-500">{roleLabel(user.role)}</div>
            </div>
            <ThemeToggle />
            <form action={logoutAction}>
              <button className="btn-secondary" type="submit">
                Sign out
              </button>
            </form>
          </div>

          {/* Mobile: hamburger drawer */}
          <MobileNav
            userName={user.name}
            roleLabel={roleLabel(user.role)}
            nav={nav}
            portal={portal}
            showSwitcher={showSwitcher}
          />
        </div>
      </header>
      <main className="mx-auto max-w-6xl overflow-x-clip px-4 py-8">{children}</main>
      <footer className="mx-auto max-w-6xl px-4 py-8 text-xs text-gray-400">
        GWA Dealer Portal · Handles personal information under PIPEDA and provincial privacy law.
        Access is logged.
      </footer>
    </div>
  );
}
