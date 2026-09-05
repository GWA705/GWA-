import Link from 'next/link';
import { SectionHero } from '@/components/SectionHero';

type Tab = 'monthly' | 'weekly' | 'pricing';

// Tab header for the dealer reports area. The pricing tab is owner-only, so it's
// shown only when the page passes `showPricing`.
export function DealerReportTabs({ active, showPricing = false }: { active: Tab; showPricing?: boolean }) {
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
        {showPricing && tab('/dealer/reports/product-pricing', 'Product & package pricing', 'pricing')}
      </div>
    </div>
  );
}
