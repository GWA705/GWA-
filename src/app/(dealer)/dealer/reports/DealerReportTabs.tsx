import Link from 'next/link';
import { SectionHero } from '@/components/SectionHero';

type Tab = 'monthly' | 'weekly' | 'pricing' | 'custom' | 'forecast';

// Tab header for the dealer reports area. Owner-only tabs (pricing, custom) are
// shown only when the page passes `showOwner`.
export function DealerReportTabs({ active, showOwner = false }: { active: Tab; showOwner?: boolean }) {
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
      <SectionHero eyebrow="Insights" title="My reports" subtitle="Performance for your office only." />
      <div className="flex flex-wrap gap-2">
        {tab('/dealer/reports', 'Monthly performance', 'monthly')}
        {tab('/dealer/reports/weekly', 'Weekly store detail', 'weekly')}
        {showOwner && tab('/dealer/reports/product-pricing', 'Product & package pricing', 'pricing')}
        {showOwner && tab('/dealer/reports/custom', 'Custom report', 'custom')}
        {showOwner && tab('/dealer/reports/forecast', 'Sales forecast', 'forecast')}
      </div>
    </div>
  );
}
