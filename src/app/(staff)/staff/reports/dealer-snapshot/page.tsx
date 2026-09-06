import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { canViewDealerSnapshot } from '@/lib/reporting/access';
import { reportingJournalEnabled } from '@/lib/reporting/journalRead';
import { buildDealerSnapshot } from '@/lib/reporting/dealerSnapshot';
import { DealerSnapshotView } from '../DealerSnapshotView';
import { getT, getLocale } from '@/i18n/server';

export const dynamic = 'force-dynamic';

function monthOptions(count: number, intlLocale: string): { value: string; label: string }[] {
  const now = new Date();
  const out: { value: string; label: string }[] = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleString(intlLocale, { month: 'long', year: 'numeric' }),
    });
  }
  return out;
}

export default async function DealerSnapshotPage({ searchParams }: { searchParams: { ym?: string } }) {
  const user = await requireRole('REVIEWER', 'ADMIN');
  // Sensitive cross-dealer financials — Super Admin, or a specific granted user.
  if (!(await canViewDealerSnapshot(user))) notFound();

  const t = getT();
  const intlLocale = getLocale() === 'fr' ? 'fr-CA' : 'en-US';
  const months = monthOptions(18, intlLocale);

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
        {t('staffReports.backAllReports')}
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-gray-900">{t('staffReports.dsTitle')}</h1>
        <p className="mt-1 text-sm text-gray-600">
          {t('staffReports.dsDesc')}
        </p>
      </div>

      <form method="GET" className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="ym">{t('reports.month')}</label>
          <select id="ym" name="ym" defaultValue={ym} className="input min-w-[160px]">
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-primary">{t('reports.view')}</button>
      </form>

      {!reportingJournalEnabled() ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {t('staffReports.journalNotConnectedShort')}
        </div>
      ) : (
        <DealerSnapshotView snap={await buildDealerSnapshot(year, monthIndex)} />
      )}
    </div>
  );
}
