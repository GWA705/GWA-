import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { canViewLeadershipSnapshot } from '@/lib/reporting/access';
import { reportingJournalEnabled } from '@/lib/reporting/journalRead';
import { buildWeeklySnapshot } from '@/lib/reporting/aggregate';
import { WeeklySnapshotView } from '../WeeklySnapshotView';

export const dynamic = 'force-dynamic';

export default async function WeeklySnapshotPage({
  searchParams,
}: {
  searchParams: { weeks?: string };
}) {
  const user = await requireRole('REVIEWER', 'ADMIN');
  if (!(await canViewLeadershipSnapshot(user))) notFound();

  // Only past/current weeks; never the future.
  const weeksOffset = Math.min(0, parseInt(searchParams.weeks ?? '0', 10) || 0);

  if (!reportingJournalEnabled()) {
    return <ConnectJournals />;
  }

  const asOf = new Date();
  asOf.setDate(asOf.getDate() + weeksOffset * 7);
  const snap = await buildWeeklySnapshot(asOf);

  return (
    <div className="space-y-4">
      <Link href="/staff/reports" className="text-sm text-gray-500 hover:underline">
        ← All reports
      </Link>
      <WeeklySnapshotView snap={snap} weeksOffset={weeksOffset} />
    </div>
  );
}

function ConnectJournals() {
  return (
    <div className="max-w-2xl space-y-4">
      <Link href="/staff/reports" className="text-sm text-gray-500 hover:underline">
        ← All reports
      </Link>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
        <h1 className="text-lg font-semibold text-amber-900">Connect the sales journals</h1>
        <p className="mt-2 text-sm text-amber-800">
          The weekly snapshot reads the GHS Sales Journal spreadsheets (2026 + 2025). To turn it on, set these
          on the server (the same Google service account already used to write the journal):
        </p>
        <ul className="mt-3 space-y-1 text-sm text-amber-800">
          <li>
            <code className="rounded bg-amber-100 px-1">JOURNAL_SHEET_ID_2026</code> — the 2026 journal spreadsheet ID
            (falls back to <code className="rounded bg-amber-100 px-1">JOURNAL_SHEET_ID</code>)
          </li>
          <li>
            <code className="rounded bg-amber-100 px-1">JOURNAL_SHEET_ID_2025</code> — the 2025 journal spreadsheet ID
          </li>
        </ul>
        <p className="mt-3 text-xs text-amber-700">
          The service account must have at least view access to both spreadsheets.
        </p>
      </div>
    </div>
  );
}
