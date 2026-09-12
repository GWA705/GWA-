import Link from 'next/link';
import { SectionHero } from '@/components/SectionHero';
import { getT } from '@/i18n/server';
import { ReportTabSelect } from './ReportTabSelect';

type Tab = 'monthly' | 'weekly' | 'overall' | 'funding' | 'products' | 'leaderboard' | 'pricing' | 'custom' | 'forecast' | 'reps' | 'accounting';

// Tab header for the dealer reports area. On phones this is a single dropdown
// (the strip used to scroll sideways and hide tabs); on wider screens it's a
// segmented tab strip. Owner-only tabs (pricing, reps, custom, forecast,
// accounting) are shown only when the page passes `showOwner`.
export function DealerReportTabs({ active, showOwner = false }: { active: Tab; showOwner?: boolean }) {
  const t = getT();

  const items: { href: string; label: string; key: Tab; show: boolean }[] = [
    { href: '/dealer/reports', label: t('reports.tabMonthly'), key: 'monthly', show: true },
    { href: '/dealer/reports/weekly', label: t('reports.tabWeekly'), key: 'weekly', show: true },
    { href: '/dealer/reports/overall-sales', label: t('reports.tabOverall'), key: 'overall', show: true },
    { href: '/dealer/reports/funding', label: t('reports.tabFunding'), key: 'funding', show: true },
    { href: '/dealer/reports/product-mix', label: t('reports.tabProducts'), key: 'products', show: true },
    { href: '/dealer/reports/leaderboard', label: t('reports.tabLeaderboard'), key: 'leaderboard', show: true },
    { href: '/dealer/reports/product-pricing', label: t('reports.tabPricing'), key: 'pricing', show: showOwner },
    { href: '/dealer/reports/sales-reps', label: t('reports.tabReps'), key: 'reps', show: showOwner },
    { href: '/dealer/reports/custom', label: t('reports.tabCustom'), key: 'custom', show: showOwner },
    { href: '/dealer/reports/forecast', label: t('reports.tabForecast'), key: 'forecast', show: showOwner },
    { href: '/dealer/reports/accounting', label: t('reports.tabAccounting'), key: 'accounting', show: showOwner },
  ];
  const visible = items.filter((i) => i.show);

  return (
    <div className="space-y-3">
      <SectionHero eyebrow={t('reports.heroEyebrow')} title={t('reports.heroTitle')} subtitle={t('reports.heroSubtitle')} bgImage="/reports-hero.webp" />

      {/* Phone: one dropdown that jumps to the report. */}
      <div className="sm:hidden">
        <ReportTabSelect items={visible.map(({ href, label, key }) => ({ href, label, key }))} active={active} />
      </div>

      {/* Wider screens: the segmented tab strip. */}
      <div className="hidden overflow-x-auto pb-1 sm:block">
        <div className="inline-flex gap-1 rounded-xl border border-gray-200 bg-[#eef5ff] p-1 dark:border-white/10 dark:bg-white/5">
          {visible.map((i) => (
            <Link
              key={i.key}
              href={i.href}
              aria-current={active === i.key ? 'page' : undefined}
              className={`whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm font-semibold transition ${
                active === i.key
                  ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-700 dark:text-white'
                  : 'text-gray-500 hover:text-blue-700 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              {i.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
