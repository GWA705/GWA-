'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, Home, MessageCircle, Plus, Users, type LucideIcon } from 'lucide-react';
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
  href?: string;
  /** Non-navigation tab: opens the support chat widget instead of routing. */
  action?: 'chat';
  labelKey: string;
  Icon: LucideIcon;
  /** Center call-to-action (raised blue button). */
  primary?: boolean;
}

// The everyday dealer actions, in thumb order. The center "New" is emphasized
// like a native tab-bar action button. Support/chat lives here (in place of Mail,
// which stays in the header bell + hamburger) so it's always one tap away and no
// longer needs a floating bubble on phones. The full menu is in the drawer.
const TABS: Tab[] = [
  { href: '/dealer', labelKey: 'quickBar.home', Icon: Home },
  { href: '/dealer/applications', labelKey: 'quickBar.applications', Icon: FileText },
  { href: '/dealer/applications/new', labelKey: 'quickBar.new', Icon: Plus, primary: true },
  { href: '/dealer/leads', labelKey: 'quickBar.leads', Icon: Users },
  { action: 'chat', labelKey: 'quickBar.help', Icon: MessageCircle },
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

function openSupportChat() {
  window.dispatchEvent(new CustomEvent('gwa:open-chat', { detail: { support: true } }));
}

/**
 * Dealer-only bottom shortcut bar for phones/tablets (hidden at `lg`, where the
 * sidebar takes over). Opt-out per device via the mobile menu toggle.
 */
export function DealerBottomNav({ nav }: { nav: NavItem[] }) {
  const pathname = usePathname() ?? '/dealer';
  const t = useT();
  const [enabled] = useQuickBar();

  if (!enabled) return null;

  const flat = nav.flatMap((i) => (i.children?.length ? i.children : [i]));
  const badgeFor = (href?: string) => (href ? flat.find((i) => i.href === href)?.badge ?? false : false);

  const baseTab = (active: boolean) =>
    `relative flex w-full flex-col items-center gap-1 px-1 py-2 text-[10px] font-medium transition ${
      active ? 'text-blue-700 dark:text-blue-300' : 'text-gray-500 hover:text-blue-700 dark:text-slate-400'
    }`;

  return (
    <nav
      aria-label={t('quickBar.settingLabel')}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_10px_-6px_rgba(16,24,40,0.25)] backdrop-blur dark:border-white/10 dark:bg-[#0a1120]/95 lg:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around">
        {TABS.map((tab) => {
          const key = tab.href ?? tab.action ?? tab.labelKey;
          const active = tab.href ? tabActive(pathname, tab.href) : false;
          const label = t(tab.labelKey);
          const showBadge = badgeFor(tab.href);

          if (tab.primary && tab.href) {
            return (
              <li key={key} className="flex flex-1 justify-center">
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

          const inner = (
            <>
              <span className="relative">
                <tab.Icon size={22} strokeWidth={active ? 2.4 : 1.9} />
                {showBadge && (
                  <span className="absolute -right-1.5 -top-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-[#0a1120]" aria-hidden />
                )}
              </span>
              <span className="max-w-full truncate leading-none">{label}</span>
            </>
          );

          return (
            <li key={key} className="flex flex-1">
              {tab.action === 'chat' ? (
                <button type="button" onClick={openSupportChat} aria-label={label} className={baseTab(false)}>
                  {inner}
                </button>
              ) : (
                <Link href={tab.href!} aria-current={active ? 'page' : undefined} className={baseTab(active)}>
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
