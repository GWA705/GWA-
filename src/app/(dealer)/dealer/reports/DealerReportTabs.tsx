import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';

// Simple two-tab header for the dealer reports area.
export function DealerReportTabs({ active }: { active: 'monthly' | 'weekly' }) {
  const tab = (href: string, label: string, key: 'monthly' | 'weekly') => (
    <Link
      href={href}
      className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
        active === key ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {label}
    </Link>
  );
  return (
    <div>
      <PageHeader eyebrow="Reports" title="My reports" subtitle="Performance for your office only." />
      <div className="mt-3 flex flex-wrap gap-2">
        {tab('/dealer/reports', 'Monthly performance', 'monthly')}
        {tab('/dealer/reports/weekly', 'Weekly store detail', 'weekly')}
      </div>
    </div>
  );
}
