import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { isSuperAdmin } from '@/lib/rbac';
import { reportingJournalEnabled } from '@/lib/reporting/journalRead';
import { buildDealerSnapshot } from '@/lib/reporting/dealerSnapshot';
import { DealerSnapshotView } from '../DealerSnapshotView';

export const dynamic = 'force-dynamic';

function monthOptions(count: number): { value: string; label: string }[] {
  const now = new Date();
  const out: { value: string; label: string }[] = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
    });
  }
  return out;
}

export default async function DealerSnapshotPage({ searchParams }: { searchParams: { ym?: string } }) {
  const user = await requireRole('REVIEWER', 'ADMIN');
  // Sensitive cross-dealer financials — locked to Super Admin only.
  if (!isSuperAdmin(user)) notFound();

  const months = monthOptions(18);

  // Default to the current month (this report is a live "what's pending now" view).
  const now = new Date();
  const defYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const ym = months.some((m) => m.value === searchParams.ym) ? (searchParams.ym as string) : defYm;
  const [yStr, mStr] = ym.split('-');
  const year = parseInt(yStr, 10);
  const monthIndex = parseInt(mStr, 10) - 1;

  return (
    <div className="space-y-5">
      <Link href="/staff/reports" className="text-sm text-gray-500 hover:underline">
        ← All reports
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-gray-900">Dealer Snapshot</h1>
        <p className="mt-1 text-sm text-gray-600">
          One row per dealer — sold and paid this month, and what&apos;s pending now. Open a dealer to see every paid and
          pending deal, each tagged HD or GWA. Built for a quick glance before a dealer call.
        </p>
      </div>

      <form method="GET" className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="ym">Month</label>
          <select id="ym" name="ym" defaultValue={ym} className="input min-w-[160px]">
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-primary">View</button>
      </form>

      {!reportingJournalEnabled() ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          The sales journals aren&apos;t connected yet.
        </div>
      ) : (
        <DealerSnapshotView snap={await buildDealerSnapshot(year, monthIndex)} />
      )}
    </div>
  );
}
