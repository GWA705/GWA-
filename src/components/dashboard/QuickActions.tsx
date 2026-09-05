'use client';

import Link from 'next/link';
import { UserPlus, BookOpen, Gift, ShoppingCart, Zap } from 'lucide-react';
import { useT } from '@/i18n/client';

const TONE: Record<'dark' | 'blue' | 'soft', string> = {
  dark: 'bg-[#073d8c] text-white',
  blue: 'bg-blue-600 text-white',
  soft: 'bg-[#f4f8fd] text-blue-700 border border-blue-100',
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
            className={`flex min-h-[105px] flex-col items-center justify-center rounded-xl p-4 text-center transition hover:opacity-95 ${TONE[a.tone]}`}
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
