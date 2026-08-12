import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { canViewReportsArea } from '@/lib/reporting/access';
import { journalDiagnostics } from '@/lib/reporting/journalRead';
import { CopyField } from './CopyField';

export const dynamic = 'force-dynamic';

export default async function JournalConnectionPage() {
  const user = await requireRole('REVIEWER', 'ADMIN');
  if (!(await canViewReportsArea(user))) notFound();

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];
  const diag = await journalDiagnostics(years);

  return (
    <div className="max-w-2xl space-y-5">
      <Link href="/staff/reports" className="text-sm text-gray-500 hover:underline">
        ← All reports
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-gray-900">Journal connection</h1>
        <p className="mt-1 text-sm text-gray-600">
          Confirms the portal can read each year&apos;s sales journal, and shows the service-account email to share
          the sheets with.
        </p>
      </div>

      {/* Service account */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900">Service account to share sheets with</h2>
        {diag.serviceAccountEmail ? (
          <>
            <p className="mt-1 text-xs text-gray-500">
              Open each journal in Google Sheets → <strong>Share</strong> → paste this address → set it to{' '}
              <strong>Viewer</strong>.
            </p>
            <div className="mt-3">
              <CopyField value={diag.serviceAccountEmail} />
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-amber-700">
            {diag.hasCredentials
              ? 'Credentials are set but the service-account email could not be read.'
              : 'No Google credentials are configured on the server yet.'}
          </p>
        )}
      </div>

      {/* Per-year status */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Year journals</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {diag.years.map((y) => (
            <div key={y.year} className="flex items-start justify-between gap-4 px-5 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{y.year}</span>
                  <StatusBadge y={y} />
                </div>
                {y.ok ? (
                  <div className="mt-0.5 text-xs text-gray-500">
                    {y.title} · {y.monthTabs} month tab{y.monthTabs === 1 ? '' : 's'} ({y.totalTabs} total)
                  </div>
                ) : y.configured ? (
                  <div className="mt-0.5 break-words text-xs text-red-600">
                    {y.error ?? 'Could not open this sheet.'}
                    {y.error?.toLowerCase().includes('permission') || y.error?.includes('403') ? (
                      <span className="block text-gray-500">
                        → Share this year&apos;s sheet with the service-account email above.
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-0.5 text-xs text-gray-400">
                    No sheet ID set. Add <code className="rounded bg-gray-100 px-1">JOURNAL_SHEET_ID_{y.year}</code> on
                    the server.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Link href="/staff/reports/connection" className="btn-secondary text-sm">
          Recheck
        </Link>
        <span className="text-xs text-gray-400">Runs a fresh check each time this page loads.</span>
      </div>
    </div>
  );
}

function StatusBadge({ y }: { y: { configured: boolean; ok: boolean } }) {
  if (!y.configured) return <span className="badge bg-gray-100 text-gray-500">Not set</span>;
  if (y.ok) return <span className="badge bg-green-100 text-green-800">Connected</span>;
  return <span className="badge bg-red-100 text-red-700">Error</span>;
}
