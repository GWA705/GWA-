'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logoutAction } from '@/app/(auth)/actions';
import { ThemeToggle } from '@/components/ThemeToggle';
import { MobileNav } from '@/components/MobileNav';
import {
  Home, FileText, UserPlus, Mail, Users, ShoppingCart, Gift, BookOpen, BarChart3,
  Building2, Headphones, Wrench, Search, Bell, LogOut, Droplets, ArrowLeftRight,
  Calculator, CreditCard, Megaphone, GraduationCap, UserCircle, type LucideIcon,
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
  if (l.includes('find') || l.includes('search')) return Search;
  if (l.includes('application') || l.includes('deals')) return FileText;
  if (l.includes('mail')) return Mail;
  if (l.includes('payout') || l.includes('calculat')) return Calculator;
  if (l.includes('report')) return BarChart3;
  if (l.includes('marketplace')) return ShoppingCart;
  if (l.includes('lead')) return Users;
  if (l.includes('gift')) return Gift;
  if (l.includes('library') || l.includes('product')) return BookOpen;
  if (l.includes('promotion')) return Megaphone;
  if (l.includes('credit card')) return CreditCard;
  if (l.includes('tutorial')) return GraduationCap;
  if (l.includes('resource')) return BookOpen;
  if (l.includes('request') || l.includes('login')) return UserPlus;
  if (l.includes('office') || l.includes('profile')) return Building2;
  if (l.includes('account')) return UserCircle;
  if (l.includes('support') || l.includes('contact')) return Headphones;
  if (l.includes('tool')) return Wrench;
  return FileText;
}

function isActive(pathname: string, href?: string): boolean {
  if (!href) return false;
  if (href === '/dealer') return pathname === '/dealer';
  return pathname === href || pathname.startsWith(href + '/');
}

function SidebarLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = iconFor(item.label);
  const active = isActive(pathname, item.href);
  return (
    <Link
      href={item.href ?? '#'}
      className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
        active
          ? 'bg-blue-600 font-semibold text-white shadow-sm'
          : 'text-blue-100/85 hover:bg-white/10 hover:text-white'
      }`}
    >
      {active && <span className="absolute inset-y-1.5 left-0 w-1 rounded-full bg-sky-300" aria-hidden />}
      <Icon size={18} className={`flex-none transition ${active ? 'text-white' : 'text-sky-300/80 group-hover:text-white'}`} />
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge && <span className="h-1.5 w-1.5 flex-none rounded-full bg-sky-300" />}
    </Link>
  );
}

export function DealerShell({
  userName, roleLabel, initials, nav, mailUnread, showSwitcher, companyLogoUrl, companyName, children,
}: {
  userName: string;
  roleLabel: string;
  initials: string;
  nav: NavItem[];
  mailUnread: number;
  showSwitcher: boolean;
  companyLogoUrl?: string | null;
  companyName?: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? '/dealer';

  return (
    <div className="min-h-screen bg-[#f2f6fb] dark:bg-[#0a1120] text-gray-900">
      {/* TOP HEADER */}
      <header className="flex h-[72px] items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <MobileNav userName={userName} roleLabel={roleLabel} nav={nav} triggerClassName="topbar-btn px-2.5 lg:hidden" />
          <Link href="/dealer" className="flex items-center gap-3">
            {companyLogoUrl ? (
              // The dealer's own uploaded company logo.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={companyLogoUrl}
                alt={companyName ? `${companyName} logo` : 'Company logo'}
                className="h-11 w-11 flex-none rounded-xl border border-gray-200 bg-white object-contain p-1"
              />
            ) : (
              <div className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-blue-600">
                <Droplets className="text-white" size={24} />
              </div>
            )}
            <div className="leading-tight">
              <div className="text-base font-extrabold tracking-tight text-[#0e2756] dark:text-slate-100 sm:text-lg">Dealer Portal</div>
              <div className="text-[10px] font-semibold tracking-[0.18em] text-blue-500">GEORGIAN WATER &amp; AIR</div>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <form action="/dealer/applications" method="get" className="hidden items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 xl:flex">
            <Search size={17} className="text-gray-400" />
            <input name="q" className="w-52 bg-transparent text-sm outline-none" placeholder="Search customers or applications…" />
          </form>

          {showSwitcher && (
            <Link
              href="/staff"
              className="hidden items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-[#0e2756] dark:text-slate-100 transition hover:bg-gray-100 sm:inline-flex"
              title="Switch to Reviewer view"
            >
              <ArrowLeftRight size={14} className="text-blue-600" />
              <span className="hidden lg:inline">Reviewer</span>
            </Link>
          )}

          <Link href="/dealer/mail" className="relative text-[#0e2756] dark:text-slate-100 hover:text-blue-700" aria-label="Mail">
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
        <aside className="sticky top-0 hidden h-[calc(100vh-72px)] w-[240px] flex-none flex-col bg-gradient-to-b from-[#06285a] to-[#04173a] lg:flex">
          <nav className="sidebar-scroll min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
            {nav.map((item) =>
              item.children ? (
                <div key={item.label} className="pt-3 first:pt-0">
                  <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-300/60">{item.label}</div>
                  <div className="space-y-0.5">
                    {item.children.map((c) => <SidebarLink key={c.label} item={c} pathname={pathname} />)}
                  </div>
                </div>
              ) : (
                <SidebarLink key={item.label} item={item} pathname={pathname} />
              ),
            )}
          </nav>
          <div className="flex flex-none items-center gap-2.5 border-t border-white/10 px-4 py-3">
            <div className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-white/10">
              <Droplets size={17} className="text-sky-300" />
            </div>
            <div className="leading-tight">
              <div className="text-[11px] font-semibold text-blue-50">Georgian Water &amp; Air</div>
              <div className="text-[9px] font-medium tracking-wide text-blue-300/70">Cleaner water · Healthier air</div>
            </div>
          </div>
        </aside>

        {/* MAIN */}
        <main className="min-w-0 flex-1 p-4 sm:p-5">{children}</main>
      </div>
    </div>
  );
}
