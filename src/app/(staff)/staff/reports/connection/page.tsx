import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { canViewReportsArea } from '@/lib/reporting/access';
import { journalDiagnostics, sheetIdFor, EARLIEST_JOURNAL_YEAR } from '@/lib/reporting/journalRead';
import { journalWriteTarget } from '@/lib/journal';
import { isAdmin } from '@/lib/rbac';
import { CopyField } from './CopyField';
import { WriteModeToggle } from './WriteModeToggle';

export const dynamic = 'force-dynamic';

export default async function JournalConnectionPage() {
  const user = await requireRole('REVIEWER', 'ADMIN');
  if (!(await canViewReportsArea(user))) notFound();

  const currentYear = new Date().getFullYear();
  const yearSet = new Set<number>([currentYear - 1, currentYear, currentYear + 1]);
  for (let y = EARLIEST_JOURNAL_YEAR; y < currentYear - 1; y += 1) {
    if (sheetIdFor(y)) yearSet.add(y);
  }
  const years = [...yearSet].sort((a, b) => a - b);
  const admin = isAdmin(user);
  const [diag, writeTarget] = await Promise.all([
    journalDiagnostics(years),
    admin ? journalWriteTarget() : Promise.resolve(null),
  ]);

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
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
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

      {/* Write target (admins only) */}
      {admin && writeTarget && (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Where new deals are written</h2>
              <p className="mt-1 text-xs text-gray-500">
                Reports always read the <strong>live</strong> journal. This only controls where the &ldquo;Write to
                Journal&rdquo; button saves deals — keep it on Test until you&apos;re ready to write to the real sheet.
                In <strong>Live</strong> mode each deal writes to its own sale-year journal automatically (a 2027 deal
                → the 2027 journal), so nothing to change each January.
              </p>
            </div>
            <WriteModeToggle mode={writeTarget.mode} />
          </div>
          <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
            {writeTarget.error ? (
              <span className="text-red-600">Couldn&apos;t open the write target: {writeTarget.error}</span>
            ) : (
              <>
                Currently writing {writeTarget.year} deals to:{' '}
                <strong className={writeTarget.mode === 'live' ? 'text-emerald-700' : 'text-slate-800'}>
                  {writeTarget.mode === 'live' ? 'LIVE' : 'TEST'}
                </strong>{' '}
                — <span className="font-medium">{writeTarget.title}</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Per-year status */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
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
                    {typeof y.deals === 'number' && (
                      <span className={y.deals > 0 ? ' font-semibold text-emerald-700' : ' font-semibold text-amber-700'}>
                        {' '}· {y.deals.toLocaleString('en-CA')} deal{y.deals === 1 ? '' : 's'} read
                        {y.deals === 0 ? ' (connected but nothing parsed — layout may differ)' : ''}
                      </span>
                    )}
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
