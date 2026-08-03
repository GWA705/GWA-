import { hasBothPortals, type SessionUser } from '@/lib/session';
import { roleLabel } from '@/lib/rbac';
import { logoutAction } from '@/app/(auth)/actions';
import { ThemeToggle } from '@/components/ThemeToggle';
import { MobileNav } from '@/components/MobileNav';
import { TopNav } from '@/components/TopNav';
import Link from 'next/link';

interface NavItem {
  href: string;
  label: string;
}

// Switcher shown to users who can use both portals (an internal user linked to
// a dealer): jump between the dealer view and the reviewer view with one login.
// Styled for the blue bar (translucent pills, active pill white).
function PortalSwitcher({ current }: { current: 'dealer' | 'staff' }) {
  return (
    <div className="topbar-switch">
      <Link href="/dealer" aria-current={current === 'dealer'}>Dealer view</Link>
      <Link href="/staff" aria-current={current === 'staff'}>Reviewer view</Link>
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
        <div className="mx-auto max-w-6xl px-4 py-3">
          {/* Row 1: brand + who's signed in + controls */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <MobileNav
              userName={user.name}
              roleLabel={roleLabel(user.role)}
              nav={nav}
              triggerClassName="topbar-btn px-2.5"
            />
            <span className="text-lg font-semibold text-brand-700">GWA Dealer Portal</span>
            {showSwitcher && <PortalSwitcher current={portal as 'dealer' | 'staff'} />}
            <div className="ml-auto hidden items-center gap-2 sm:flex">
              <div className="text-right leading-tight">
                <div className="text-sm font-semibold text-brand-800">{user.name}</div>
                <div className="text-xs text-gray-500">{roleLabel(user.role)}</div>
              </div>
              <ThemeToggle className="topbar-btn" />
              <form action={logoutAction}>
                <button className="topbar-btn" type="submit">
                  Sign out
                </button>
              </form>
            </div>
          </div>

          {/* Row 2: the link tray (desktop/tablet; mobile uses the drawer) */}
          <div className="mt-3 hidden sm:block">
            <TopNav nav={nav} />
          </div>
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
