'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logoutAction } from '@/app/(auth)/actions';
import { ThemeToggle } from '@/components/ThemeToggle';
import { MobileNav } from '@/components/MobileNav';
import {
  FileText, Mail, MessageSquare, Gift, Building2, Users, BarChart3, UserCircle,
  ShieldCheck, Wrench, Search, Bell, LogOut, Droplets, ArrowLeftRight, type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href?: string;
  label: string;
  badge?: boolean;
  children?: NavItem[];
}

/** Best-effort icon for a staff nav label. */
function iconFor(label: string): LucideIcon {
  const l = label.toLowerCase();
  if (l.includes('deal') || l.includes('queue')) return FileText;
  if (l.includes('mail')) return Mail;
  if (l.includes('chat') || l.includes('conversation')) return MessageSquare;
  if (l.includes('gift')) return Gift;
  if (l.includes('director')) return Building2;
  if (l.includes('find') || l.includes('customer')) return Search;
  if (l.includes('lead')) return Users;
  if (l.includes('report')) return BarChart3;
  if (l.includes('account')) return UserCircle;
  if (l.includes('admin')) return ShieldCheck;
  if (l.includes('tool')) return Wrench;
  return FileText;
}

function isActive(pathname: string, href?: string): boolean {
  if (!href) return false;
  if (href === '/staff') return pathname === '/staff';
  if (href === '/account') return pathname === '/account';
  return pathname === href || pathname.startsWith(href + '/');
}

function SidebarLink({ item, pathname, sub }: { item: NavItem; pathname: string; sub?: boolean }) {
  const Icon = iconFor(item.label);
  const active = isActive(pathname, item.href);
  return (
    <Link
      href={item.href ?? '#'}
      className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm transition ${
        active ? 'bg-gradient-to-r from-blue-600 to-blue-500 font-semibold text-white shadow-lg'
        : 'text-blue-50 hover:bg-white/10'
      } ${sub ? 'py-2 pl-11 text-[13px]' : ''}`}
    >
      {!sub && <Icon size={20} className="flex-none" />}
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge && <span className="h-2 w-2 flex-none rounded-full bg-sky-300" />}
    </Link>
  );
}

export function StaffShell({
  userName, roleLabel, initials, nav, mailUnread = 0, showSwitcher, children,
}: {
  userName: string;
  roleLabel: string;
  initials: string;
  nav: NavItem[];
  mailUnread?: number;
  showSwitcher: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? '/staff';

  return (
    <div className="min-h-screen bg-[#f2f6fb] dark:bg-[#0a1120] text-gray-900">
      {/* TOP HEADER */}
      <header className="flex h-[72px] items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <MobileNav userName={userName} roleLabel={roleLabel} nav={nav} triggerClassName="topbar-btn px-2.5 lg:hidden" />
          <Link href="/staff" className="flex items-center gap-3">
            <div className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-blue-600">
              <Droplets className="text-white" size={24} />
            </div>
            <div className="leading-tight">
              <div className="text-base font-extrabold tracking-tight text-[#0e2756] dark:text-slate-100 sm:text-lg">Reviewer Portal</div>
              <div className="text-[10px] font-semibold tracking-[0.18em] text-blue-500">GEORGIAN WATER &amp; AIR</div>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <form action="/staff" method="get" className="hidden items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 xl:flex">
            <Search size={17} className="text-gray-400" />
            <input name="q" className="w-52 bg-transparent text-sm outline-none" placeholder="Search deals…" />
          </form>

          {showSwitcher && (
            <Link
              href="/dealer"
              className="hidden items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-[#0e2756] dark:text-slate-100 transition hover:bg-gray-100 sm:inline-flex"
              title="Switch to Dealer view"
            >
              <ArrowLeftRight size={14} className="text-blue-600" />
              <span className="hidden lg:inline">Dealer view</span>
            </Link>
          )}

          <Link href="/staff/mail" className="relative text-[#0e2756] dark:text-slate-100 hover:text-blue-700" aria-label="Mail">
            <Bell size={22} />
            {mailUnread > 0 && (
              <span className="absolute -right-2 -top-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {mailUnread > 9 ? '9+' : mailUnread}
              </span>
            )}
          </Link>

          <div className="hidden text-right leading-tight sm:block">
            <div className="text-sm font-bold text-[#0e2756] dark:text-slate-100">{userName}</div>
            <div className="text-xs text-gray-500">{roleLabel}</div>
          </div>
          <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-blue-700 text-sm font-bold text-white">{initials}</div>
          <ThemeToggle className="topbar-btn hidden sm:inline-flex" />
          <form action={logoutAction}>
            <button type="submit" className="topbar-btn inline-flex items-center gap-1.5 text-sm" title="Sign out">
              <LogOut size={16} /> <span className="hidden sm:inline">Sign out</span>
            </button>
          </form>
        </div>
      </header>

      <div className="flex">
        {/* SIDEBAR (desktop) */}
        <aside className="sticky top-0 hidden h-[calc(100vh-72px)] w-[230px] flex-none flex-col bg-gradient-to-b from-[#052755] to-[#031d43] px-3 py-4 text-white lg:flex">
          <nav className="sidebar-scroll min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-1">
            {nav.map((item) =>
              item.children ? (
                <div key={item.label} className="pt-1.5">
                  <div className="px-4 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-300/70">{item.label}</div>
                  {item.children.map((c) => <SidebarLink key={c.label} item={c} pathname={pathname} sub />)}
                </div>
              ) : (
                <SidebarLink key={item.label} item={item} pathname={pathname} />
              ),
            )}
          </nav>
          <div className="flex flex-none items-center gap-3 border-t border-white/10 px-4 pb-1 pt-3">
            <Droplets size={26} className="flex-none text-sky-400" />
            <div className="text-[10px] font-semibold leading-4 tracking-[0.2em] text-blue-200/90">
              CLEANER WATER · HEALTHIER AIR<br />BRIGHTER TOMORROWS
            </div>
          </div>
        </aside>

        {/* MAIN */}
        <main className="min-w-0 flex-1 p-4 sm:p-6">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
