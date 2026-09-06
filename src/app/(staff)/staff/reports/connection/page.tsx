import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { canViewReportsArea } from '@/lib/reporting/access';
import { journalDiagnostics, sheetIdFor, EARLIEST_JOURNAL_YEAR } from '@/lib/reporting/journalRead';
import { journalWriteTarget } from '@/lib/journal';
import { isAdmin } from '@/lib/rbac';
import { getT } from '@/i18n/server';
import type { TFunction } from '@/i18n/translator';
import { CopyField } from './CopyField';
import { WriteModeToggle } from './WriteModeToggle';

export const dynamic = 'force-dynamic';

export default async function JournalConnectionPage() {
  const user = await requireRole('REVIEWER', 'ADMIN');
  if (!(await canViewReportsArea(user))) notFound();

  const t = getT();
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
        ← {t('connectionReport.allReports')}
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-gray-900">{t('connectionReport.title')}</h1>
        <p className="mt-1 text-sm text-gray-600">{t('connectionReport.intro')}</p>
      </div>

      {/* Service account */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-900">{t('connectionReport.serviceAccountHeading')}</h2>
        {diag.serviceAccountEmail ? (
          <>
            <p className="mt-1 text-xs text-gray-500">
              {t('connectionReport.shareStep1')}
              <strong>{t('connectionReport.shareStepShare')}</strong>
              {t('connectionReport.shareStep2')}
              <strong>{t('connectionReport.shareStepViewer')}</strong>
              {t('connectionReport.shareStep3')}
            </p>
            <div className="mt-3">
              <CopyField value={diag.serviceAccountEmail} />
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-amber-700">
            {diag.hasCredentials
              ? t('connectionReport.credsSetNoEmail')
              : t('connectionReport.noCreds')}
          </p>
        )}
      </div>

      {/* Write target (admins only) */}
      {admin && writeTarget && (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">{t('connectionReport.writeHeading')}</h2>
              <p className="mt-1 text-xs text-gray-500">
                {t('connectionReport.writeDesc1')}
                <strong>{t('connectionReport.writeLive1')}</strong>
                {t('connectionReport.writeDesc2')}
                <strong>{t('connectionReport.writeLive2')}</strong>
                {t('connectionReport.writeDesc3')}
              </p>
            </div>
            <WriteModeToggle mode={writeTarget.mode} />
          </div>
          <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
            {writeTarget.error ? (
              <span className="text-red-600">{t('connectionReport.writeTargetError', { error: writeTarget.error })}</span>
            ) : (
              <>
                {t('connectionReport.currentlyWriting', { year: writeTarget.year })}{' '}
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
          <h2 className="text-sm font-semibold text-gray-900">{t('connectionReport.yearJournals')}</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {diag.years.map((y) => (
            <div key={y.year} className="flex items-start justify-between gap-4 px-5 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{y.year}</span>
                  <StatusBadge y={y} t={t} />
                </div>
                {y.ok ? (
                  <div className="mt-0.5 text-xs text-gray-500">
                    {y.title} ·{' '}
                    {y.monthTabs === 1
                      ? t('connectionReport.monthTabOne', { n: y.monthTabs ?? 0 })
                      : t('connectionReport.monthTabsMany', { n: y.monthTabs ?? 0 })}{' '}
                    {t('connectionReport.totalTabs', { n: y.totalTabs ?? 0 })}
                    {typeof y.deals === 'number' && (
                      <span className={y.deals > 0 ? ' font-semibold text-emerald-700' : ' font-semibold text-amber-700'}>
                        {' '}·{' '}
                        {y.deals === 1
                          ? t('connectionReport.dealReadOne', { n: y.deals.toLocaleString('en-CA') })
                          : t('connectionReport.dealsReadMany', { n: y.deals.toLocaleString('en-CA') })}
                        {y.deals === 0 ? ' ' + t('connectionReport.nothingParsed') : ''}
                      </span>
                    )}
                  </div>
                ) : y.configured ? (
                  <div className="mt-0.5 break-words text-xs text-red-600">
                    {y.error ?? t('connectionReport.couldNotOpen')}
                    {y.error?.toLowerCase().includes('permission') || y.error?.includes('403') ? (
                      <span className="block text-gray-500">{t('connectionReport.shareHint')}</span>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-0.5 text-xs text-gray-400">
                    {t('connectionReport.noSheetIdPrefix')}
                    <code className="rounded bg-gray-100 px-1">JOURNAL_SHEET_ID_{y.year}</code>
                    {t('connectionReport.noSheetIdSuffix')}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Link href="/staff/reports/connection" className="btn-secondary text-sm">
          {t('connectionReport.recheck')}
        </Link>
        <span className="text-xs text-gray-400">{t('connectionReport.recheckHint')}</span>
      </div>
    </div>
  );
}

function StatusBadge({ y, t }: { y: { configured: boolean; ok: boolean }; t: TFunction }) {
  if (!y.configured) return <span className="badge bg-gray-100 text-gray-500">{t('connectionReport.statusNotSet')}</span>;
  if (y.ok) return <span className="badge bg-green-100 text-green-800">{t('connectionReport.statusConnected')}</span>;
  return <span className="badge bg-red-100 text-red-700">{t('connectionReport.statusError')}</span>;
}
