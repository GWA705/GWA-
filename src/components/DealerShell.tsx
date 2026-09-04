'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logoutAction } from '@/app/(auth)/actions';
import { ThemeToggle } from '@/components/ThemeToggle';
import { MobileNav } from '@/components/MobileNav';
import {
  Home, FileText, UserPlus, Mail, Users, ShoppingCart, Gift, BookOpen, BarChart3,
  Building2, Headphones, Wrench, Search, Bell, LogOut, Droplets, ChevronRight, type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href?: string;
  label: string;
  badge?: boolean;
  children?: NavItem[];
}

/** Best-effort icon for a nav label. */
function iconFor(label: string): LucideIcon {
  const l = label.toLowerCase();
  if (l.includes('home') || l === 'dashboard') return Home;
  if (l.includes('new customer')) return UserPlus;
  if (l.includes('application') || l.includes('deals')) return FileText;
  if (l.includes('mail')) return Mail;
  if (l.includes('lead')) return Users;
  if (l.includes('marketplace')) return ShoppingCart;
  if (l.includes('gift')) return Gift;
  if (l.includes('resource')) return BookOpen;
  if (l.includes('report')) return BarChart3;
  if (l.includes('office') || l.includes('profile')) return Building2;
  if (l.includes('support') || l.includes('contact')) return Headphones;
  if (l.includes('tool')) return Wrench;
  return FileText;
}

function isActive(pathname: string, href?: string): boolean {
  if (!href) return false;
  if (href === '/dealer') return pathname === '/dealer';
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

export function DealerShell({
  userName, roleLabel, initials, nav, mailUnread, showSwitcher, children,
}: {
  userName: string;
  roleLabel: string;
  initials: string;
  nav: NavItem[];
  mailUnread: number;
  showSwitcher: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? '/dealer';

  return (
    <div className="min-h-screen bg-[#f2f6fb] text-slate-900">
      {/* TOP HEADER */}
      <header className="flex h-[72px] items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <MobileNav userName={userName} roleLabel={roleLabel} nav={nav} triggerClassName="topbar-btn px-2.5 lg:hidden" />
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-blue-600">
              <Droplets className="text-white" size={24} />
            </div>
            <div className="leading-tight">
              <div className="text-[15px] font-extrabold tracking-wide text-[#0d2a63] sm:text-lg">GEORGIAN</div>
              <div className="text-[9px] font-bold tracking-[0.28em] text-blue-500">WATER &amp; AIR</div>
            </div>
            <div className="mx-2 hidden h-9 w-px bg-slate-200 md:block" />
            <div className="hidden md:block">
              <div className="text-lg font-bold text-[#0e2756]">DEALER PORTAL</div>
              <div className="text-[10px] font-medium tracking-[0.18em] text-slate-500">GROW TODAY · HEALTHIER HOMES TOMORROW</div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <form action="/dealer/applications" method="get" className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 xl:flex">
            <Search size={17} className="text-slate-400" />
            <input name="q" className="w-52 bg-transparent text-sm outline-none" placeholder="Search customers or applications…" />
          </form>

          <Link href="/dealer/mail" className="relative text-[#0e2756] hover:text-blue-700" aria-label="Mail">
            <Bell size={22} />
            {mailUnread > 0 && (
              <span className="absolute -right-2 -top-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {mailUnread > 9 ? '9+' : mailUnread}
              </span>
            )}
          </Link>

          <div className="hidden text-right leading-tight sm:block">
            <div className="text-sm font-bold text-[#0e2756]">{userName}</div>
            <div className="text-xs text-slate-500">{roleLabel}</div>
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
        <aside className="sticky top-0 hidden h-[calc(100vh-72px)] w-[230px] flex-none flex-col justify-between bg-gradient-to-b from-[#052755] to-[#031d43] px-3 py-6 text-white lg:flex">
          <nav className="space-y-1 overflow-y-auto">
            {showSwitcher && (
              <Link href="/staff" className="mb-2 flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold text-sky-200 hover:bg-white/10">
                <ChevronRight size={14} /> Switch to Reviewer view
              </Link>
            )}
            {nav.map((item) =>
              item.children ? (
                <div key={item.label} className="pt-2">
                  <div className="px-4 pb-1 text-[10px] font-bold uppercase tracking-wider text-blue-300/70">{item.label}</div>
                  {item.children.map((c) => <SidebarLink key={c.label} item={c} pathname={pathname} sub />)}
                </div>
              ) : (
                <SidebarLink key={item.label} item={item} pathname={pathname} />
              ),
            )}
          </nav>
          <div className="px-4 pb-2 pt-4">
            <Droplets size={44} className="mb-3 text-sky-400" />
            <div className="text-[11px] font-semibold leading-6 tracking-[0.22em] text-blue-200">
              CLEANER WATER<br />HEALTHIER AIR<br />BRIGHTER<br />TOMORROWS
            </div>
          </div>
        </aside>

        {/* MAIN */}
        <main className="min-w-0 flex-1 p-4 sm:p-5">{children}</main>
      </div>
    </div>
  );
}
