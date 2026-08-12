import Link from 'next/link';

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
      <h1 className="text-xl font-semibold text-gray-900">My reports</h1>
      <p className="mt-1 text-sm text-gray-600">Performance for your office only.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {tab('/dealer/reports', 'Monthly performance', 'monthly')}
        {tab('/dealer/reports/weekly', 'Weekly store detail', 'weekly')}
      </div>
    </div>
  );
}
