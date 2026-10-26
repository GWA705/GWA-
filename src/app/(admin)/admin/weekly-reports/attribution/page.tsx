import Link from 'next/link';
import { requireAdminSection } from '@/lib/session';
import { lastFullWeek, listStoreLeadSales, leadNeedsAssociate } from '@/lib/reporting/weeklyReports';
import { AttributeRow } from '../AttributeRow';

export const dynamic = 'force-dynamic';

const money = (n: number) => '$' + n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function AttributionPage() {
  await requireAdminSection('weekly-reports');
  const week = lastFullWeek();
  const leads = await listStoreLeadSales(week);
  const needing = leads.filter(leadNeedsAssociate).length;

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <Link href="/admin/weekly-reports" className="text-sm text-gray-500 hover:underline">← Weekly HD reports</Link>
        <h1 className="mt-1 text-xl font-semibold text-gray-900">Credit store‑lead associates</h1>
        <p className="mt-1 text-sm text-gray-500">
          Every <strong>701 store‑lead</strong> sale paid in <strong>{week.label}</strong>. Credit the Home Depot associate who earned it
          (or mark it an online homedepot.ca lead) before the store report goes out — the credit shows on that store's email.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <span className="rounded-lg bg-gray-50 px-3 py-2"><span className="font-bold">{leads.length}</span> store‑lead sales</span>
        <span className={`rounded-lg px-3 py-2 ${needing ? 'bg-amber-50 text-amber-800' : 'bg-green-50 text-green-800'}`}><span className="font-bold">{needing}</span> still need an associate</span>
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr><th className="px-4 py-3">Store lead</th><th className="px-4 py-3 text-right">Value</th><th className="px-4 py-3">Credit</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {leads.length === 0 ? (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-500">No 701 store‑lead sales in the last full week.</td></tr>
            ) : leads.map((l) => (
              <AttributeRow key={l.hdRef} lead={{
                hdRef: l.hdRef, customer: l.customer, storeNumber: l.storeNumber, storeName: l.storeName,
                value: money(l.value), datePaid: l.datePaid, associateName: l.associateName ?? '', associateSource: l.associateSource ?? '',
              }} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
