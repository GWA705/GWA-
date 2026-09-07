'use client';

import Link from 'next/link';
import { UserPlus, BookOpen, Gift, ShoppingCart, Zap } from 'lucide-react';
import { useT } from '@/i18n/client';

// Each tone carries a solid bottom "lip" (the 0 3px 0 shadow) + a soft drop
// shadow so the tiles read as raised, pressable buttons. Hover/active handled on
// the base class below.
const TONE: Record<'dark' | 'blue' | 'soft', string> = {
  dark: 'bg-[#073d8c] text-white ring-1 ring-[#052a63] shadow-[0_3px_0_0_#052a63,0_8px_16px_-8px_rgba(7,61,140,0.55)] hover:bg-[#0a468f]',
  blue: 'bg-blue-600 text-white ring-1 ring-blue-700 shadow-[0_3px_0_0_#1e40af,0_8px_16px_-8px_rgba(37,99,235,0.55)] hover:bg-blue-500',
  soft: 'bg-white text-blue-700 ring-1 ring-blue-200 shadow-[0_3px_0_0_#dbeafe,0_6px_14px_-8px_rgba(37,99,235,0.3)] hover:bg-blue-50 hover:ring-blue-300',
};

/** The right-rail Quick Actions grid. Links to the real routes. */
export function QuickActions() {
  const t = useT();
  const items = [
    { href: '/dealer/applications/new', title: t('quickActions.newCustomer'), subtitle: t('quickActions.newCustomerSub'), tone: 'dark' as const, Icon: UserPlus },
    { href: '/dealer/resources/library', title: t('quickActions.productResources'), subtitle: t('quickActions.productResourcesSub'), tone: 'blue' as const, Icon: BookOpen },
    { href: '/dealer/gift-cards', title: t('nav.giftCards'), subtitle: t('quickActions.giftCardsSub'), tone: 'soft' as const, Icon: Gift },
    { href: '/dealer/marketplace', title: t('quickActions.visitMarketplace'), subtitle: t('quickActions.visitMarketplaceSub'), tone: 'soft' as const, Icon: ShoppingCart },
  ];
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Zap size={22} className="text-blue-600" />
        <h3 className="text-xl font-bold text-[#0d2a63] dark:text-slate-100">{t('quickActions.title')}</h3>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {items.map((a) => (
          <Link
            key={a.title}
            href={a.href}
            className={`flex min-h-[112px] flex-col items-center justify-center rounded-xl p-4 text-center transition duration-150 hover:-translate-y-0.5 active:translate-y-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${TONE[a.tone]}`}
          >
            <a.Icon size={26} />
            <div className="mt-2 text-sm font-bold">{a.title}</div>
            <div className={`mt-1 text-[11px] ${a.tone === 'soft' ? 'text-gray-500' : 'text-blue-100'}`}>{a.subtitle}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}
