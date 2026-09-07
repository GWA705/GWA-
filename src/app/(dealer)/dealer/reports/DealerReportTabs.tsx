import Link from 'next/link';
import { SectionHero } from '@/components/SectionHero';
import { getT } from '@/i18n/server';

type Tab = 'monthly' | 'weekly' | 'pricing' | 'custom' | 'forecast' | 'reps' | 'accounting';

// Tab header for the dealer reports area. Owner-only tabs (pricing, custom) are
// shown only when the page passes `showOwner`.
export function DealerReportTabs({ active, showOwner = false }: { active: Tab; showOwner?: boolean }) {
  const t = getT();
  // Segmented control: a tinted track with the active tab as a raised "thumb".
  const tab = (href: string, label: string, key: Tab) => (
    <Link
      href={href}
      aria-current={active === key ? 'page' : undefined}
      className={`whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm font-semibold transition ${
        active === key
          ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-700 dark:text-white'
          : 'text-gray-500 hover:text-blue-700 dark:text-slate-300 dark:hover:text-white'
      }`}
    >
      {label}
    </Link>
  );
  return (
    <div className="space-y-3">
      <SectionHero eyebrow={t('reports.heroEyebrow')} title={t('reports.heroTitle')} subtitle={t('reports.heroSubtitle')} bgImage="/reports-hero.webp" />
      <div className="overflow-x-auto pb-1">
        <div className="inline-flex gap-1 rounded-xl border border-gray-200 bg-[#eef5ff] p-1 dark:border-white/10 dark:bg-white/5">
          {tab('/dealer/reports', t('reports.tabMonthly'), 'monthly')}
          {tab('/dealer/reports/weekly', t('reports.tabWeekly'), 'weekly')}
          {showOwner && tab('/dealer/reports/product-pricing', t('reports.tabPricing'), 'pricing')}
          {showOwner && tab('/dealer/reports/sales-reps', t('reports.tabReps'), 'reps')}
          {showOwner && tab('/dealer/reports/custom', t('reports.tabCustom'), 'custom')}
          {showOwner && tab('/dealer/reports/forecast', t('reports.tabForecast'), 'forecast')}
          {showOwner && tab('/dealer/reports/accounting', t('reports.tabAccounting'), 'accounting')}
        </div>
      </div>
    </div>
  );
}
