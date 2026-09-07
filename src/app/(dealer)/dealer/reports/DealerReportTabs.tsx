import Link from 'next/link';
import { SectionHero } from '@/components/SectionHero';
import { getT } from '@/i18n/server';

type Tab = 'monthly' | 'weekly' | 'pricing' | 'custom' | 'forecast' | 'reps' | 'accounting';

// Tab header for the dealer reports area. Owner-only tabs (pricing, custom) are
// shown only when the page passes `showOwner`.
export function DealerReportTabs({ active, showOwner = false }: { active: Tab; showOwner?: boolean }) {
  const t = getT();
  const tab = (href: string, label: string, key: Tab) => (
    <Link
      href={href}
      className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
        active === key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {label}
    </Link>
  );
  return (
    <div className="space-y-3">
      <SectionHero eyebrow={t('reports.heroEyebrow')} title={t('reports.heroTitle')} subtitle={t('reports.heroSubtitle')} bgImage="/reports-hero.webp" />
      <div className="flex flex-wrap gap-2">
        {tab('/dealer/reports', t('reports.tabMonthly'), 'monthly')}
        {tab('/dealer/reports/weekly', t('reports.tabWeekly'), 'weekly')}
        {showOwner && tab('/dealer/reports/product-pricing', t('reports.tabPricing'), 'pricing')}
        {showOwner && tab('/dealer/reports/sales-reps', t('reports.tabReps'), 'reps')}
        {showOwner && tab('/dealer/reports/custom', t('reports.tabCustom'), 'custom')}
        {showOwner && tab('/dealer/reports/forecast', t('reports.tabForecast'), 'forecast')}
        {showOwner && tab('/dealer/reports/accounting', t('reports.tabAccounting'), 'accounting')}
      </div>
    </div>
  );
}
