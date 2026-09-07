'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, Home, Mail, Plus, Users, type LucideIcon } from 'lucide-react';
import { useT } from '@/i18n/client';
import { useQuickBar } from '@/components/useQuickBar';

interface NavItem {
  href?: string;
  label: string;
  labelKey?: string;
  badge?: boolean;
  children?: NavItem[];
}

interface Tab {
  href: string;
  labelKey: string;
  Icon: LucideIcon;
  /** Center call-to-action (raised blue button). */
  primary?: boolean;
}

// The everyday dealer actions, in thumb order. The center "New" is emphasized
// like a native tab-bar action button. The full menu still lives in the
// hamburger drawer — this is a shortcut layer, not a replacement.
const TABS: Tab[] = [
  { href: '/dealer', labelKey: 'quickBar.home', Icon: Home },
  { href: '/dealer/applications', labelKey: 'quickBar.applications', Icon: FileText },
  { href: '/dealer/applications/new', labelKey: 'quickBar.new', Icon: Plus, primary: true },
  { href: '/dealer/leads', labelKey: 'quickBar.leads', Icon: Users },
  { href: '/dealer/mail', labelKey: 'quickBar.mail', Icon: Mail },
];

const NEW_HREF = '/dealer/applications/new';

function tabActive(pathname: string, href: string): boolean {
  if (href === '/dealer') return pathname === '/dealer';
  if (href === NEW_HREF) return pathname === NEW_HREF;
  // "Applications" owns its subtree except the dedicated New page (its own tab).
  if (href === '/dealer/applications') {
    return pathname.startsWith('/dealer/applications') && pathname !== NEW_HREF;
  }
  return pathname === href || pathname.startsWith(href + '/');
}

/**
 * Dealer-only bottom shortcut bar for phones/tablets (hidden at `lg`, where the
 * sidebar takes over). Opt-out per device via the mobile menu toggle. Reads
 * unread badges from the same `nav` array the shell already builds.
 */
export function DealerBottomNav({ nav }: { nav: NavItem[] }) {
  const pathname = usePathname() ?? '/dealer';
  const t = useT();
  const [enabled] = useQuickBar();

  if (!enabled) return null;

  const flat = nav.flatMap((i) => (i.children?.length ? i.children : [i]));
  const badgeFor = (href: string) => flat.find((i) => i.href === href)?.badge ?? false;

  return (
    <nav
      aria-label={t('quickBar.settingLabel')}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_10px_-6px_rgba(16,24,40,0.25)] backdrop-blur dark:border-white/10 dark:bg-[#0a1120]/95 lg:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around">
        {TABS.map((tab) => {
          const active = tabActive(pathname, tab.href);
          const label = t(tab.labelKey);
          const showBadge = badgeFor(tab.href);

          if (tab.primary) {
            return (
              <li key={tab.href} className="flex flex-1 justify-center">
                <Link
                  href={tab.href}
                  aria-label={label}
                  aria-current={active ? 'page' : undefined}
                  className="flex flex-col items-center gap-1 pb-1.5 pt-1"
                >
                  <span className="-mt-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg ring-4 ring-white transition active:scale-95 dark:ring-[#0a1120]">
                    <Plus size={24} />
                  </span>
                  <span className="text-[10px] font-semibold leading-none text-blue-700 dark:text-blue-300">{label}</span>
                </Link>
              </li>
            );
          }

          return (
            <li key={tab.href} className="flex flex-1">
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={`relative flex w-full flex-col items-center gap-1 px-1 py-2 text-[10px] font-medium transition ${
                  active
                    ? 'text-blue-700 dark:text-blue-300'
                    : 'text-gray-500 hover:text-blue-700 dark:text-slate-400'
                }`}
              >
                <span className="relative">
                  <tab.Icon size={22} strokeWidth={active ? 2.4 : 1.9} />
                  {showBadge && (
                    <span className="absolute -right-1.5 -top-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-[#0a1120]" aria-hidden />
                  )}
                </span>
                <span className="max-w-full truncate leading-none">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
