import Link from 'next/link';
import { requireStaffSection } from '@/lib/session';
import { prisma } from '@/lib/db';
import { getT } from '@/i18n/server';
import { reMatchUnmatchedLines } from '@/lib/hdRemittance';
import { ManualRemittanceForm } from './ManualRemittanceForm';
import { UploadRemittanceForm } from './UploadRemittanceForm';
import { ReconcileUnmatched } from './ReconcileUnmatched';

export const dynamic = 'force-dynamic';

const money = (n: number) => `$${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmt = (d: Date | null) => (d ? new Date(d).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' }) : '—');

export default async function RemittancesPage() {
  await requireStaffSection('remittances');
  const t = getT();

  const remittances = await prisma.hdRemittance.findMany({
    orderBy: { createdAt: 'desc' },
    take: 60,
    include: { _count: { select: { lines: true } } },
  });

  // Outstanding attention: unmatched lines across all remittances, and their
  // total dollar value (chargebacks excluded — those aren't missed payments).
  const unmatchedCount = await prisma.hdRemittanceLine.count({ where: { status: 'UNMATCHED' } });
  const unmatchedAgg = await prisma.hdRemittanceLine.aggregate({
    where: { status: 'UNMATCHED', isChargeback: false },
    _sum: { amount: true },
    _count: { _all: true },
  });
  const unmatchedValue = Number(unmatchedAgg._sum.amount ?? 0);
  const unmatchedPayable = unmatchedAgg._count._all;

  // Investigate: which of those unmatched lines WOULD now match a portal deal
  // (a payment that came in before its deal existed in the portal). Dry run —
  // reports the recoverable backlog without changing anything.
  const preview = unmatchedPayable > 0 ? await reMatchUnmatchedLines({ dryRun: true }) : null;

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{t('remit.list.title')}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {t('remit.list.introBefore')}<strong>{t('remit.funded')}</strong>{t('remit.list.introAfter')}
        </p>
      </div>

      <section className="card p-5">
        <h2 className="mb-1 text-base font-semibold text-gray-900">{t('remit.list.autoTitle')}</h2>
        <p className="text-sm text-gray-500">
          {t('remit.list.autoDesc1')}
          <code className="mx-1 rounded bg-gray-100 px-1.5 py-0.5 text-xs">POST /api/hd-remittance/ingest</code>
          {t('remit.list.autoDescWith')} <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">Authorization: Bearer $CRON_SECRET</code>{t('remit.list.autoDesc2')}
        </p>
      </section>

      <section className="card p-5">
        <h2 className="mb-3 text-base font-semibold text-gray-900">{t('remit.list.uploadTitle')}</h2>
        <UploadRemittanceForm />
      </section>

      <section className="card p-5">
        <h2 className="mb-3 text-base font-semibold text-gray-900">{t('remit.list.manualTitle')}</h2>
        <ManualRemittanceForm />
      </section>

      {unmatchedCount > 0 && (
        <section className="card border-amber-200 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">{t('remit.list.unmatchedTitle')}</h2>
              <p className="mt-1 text-sm text-gray-500">
                {unmatchedCount === 1 ? t('remit.list.unmatchedLinesOne', { n: unmatchedCount }) : t('remit.list.unmatchedLinesMany', { n: unmatchedCount })}
                {unmatchedPayable > 0 && (unmatchedPayable === 1
                  ? t('remit.list.unmatchedPayableOne', { amount: money(unmatchedValue), n: unmatchedPayable })
                  : t('remit.list.unmatchedPayableMany', { amount: money(unmatchedValue), n: unmatchedPayable }))}
                {t('remit.list.unmatchedExplain')}
              </p>
            </div>
          </div>

          {preview && preview.recovered > 0 ? (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4">
              <p className="text-sm font-medium text-green-900">
                {t('remit.list.previewMatch', { n: preview.recovered, amount: money(preview.amountRecovered) })}
                {preview.funded > 0 && (preview.funded === 1
                  ? t('remit.list.previewFundedOne', { n: preview.funded })
                  : t('remit.list.previewFundedMany', { n: preview.funded }))}
                {preview.partial > 0 && (preview.partial === 1
                  ? t('remit.list.previewPartialOne', { n: preview.partial })
                  : t('remit.list.previewPartialMany', { n: preview.partial }))}
                {t('remit.list.previewReapply')}
              </p>
              <ul className="mt-3 divide-y divide-green-100 text-sm">
                {preview.deals.slice(0, 30).map((d, i) => (
                  <li key={`${d.applicationId}-${i}`} className="flex items-center justify-between gap-3 py-1.5">
                    <Link href={`/staff/applications/${d.applicationId}`} className="text-brand-700 hover:underline">
                      {d.customer || t('remit.list.noName')} · HD&nbsp;#{d.hdReference}
                    </Link>
                    <span className="flex items-center gap-3 text-gray-600">
                      {d.funded ? <span className="rounded bg-green-100 px-1.5 text-xs font-medium text-green-800">→ {t('remit.funded')}</span> : <span className="rounded bg-amber-100 px-1.5 text-xs text-amber-800">{t('remit.list.partialChip')}</span>}
                      <span className="font-medium text-gray-900">{money(d.amount)}</span>
                    </span>
                  </li>
                ))}
                {preview.deals.length > 30 && <li className="py-1.5 text-xs text-gray-500">{t('remit.list.andMore', { n: preview.deals.length - 30 })}</li>}
              </ul>
            </div>
          ) : unmatchedPayable > 0 ? (
            <p className="mt-3 text-sm text-gray-500">
              {t('remit.list.noneMatchYet')}
            </p>
          ) : null}

          <div className="mt-4">
            <ReconcileUnmatched />
          </div>
        </section>
      )}

      <section className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3">{t('remit.list.colReceived')}</th>
              <th className="px-4 py-3">{t('remit.list.colDoc')}</th>
              <th className="px-4 py-3">{t('remit.paymentDate')}</th>
              <th className="px-4 py-3">{t('remit.list.colNetTotal')}</th>
              <th className="px-4 py-3">{t('remit.lines')}</th>
              <th className="px-4 py-3">{t('remit.funded')}</th>
              <th className="px-4 py-3">{t('remit.list.colChargebacks')}</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {remittances.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3 text-gray-600">{fmt(r.createdAt)}<div className="text-xs text-gray-400">{r.source === 'MANUAL' ? t('remit.list.sourceManual') : t('remit.list.sourceAuto')}</div></td>
                <td className="px-4 py-3 font-mono text-xs text-gray-700">{r.documentNumber ?? '—'}</td>
                <td className="px-4 py-3 text-gray-600">{fmt(r.paymentDate)}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{r.totalNet != null ? money(Number(r.totalNet)) : '—'}</td>
                <td className="px-4 py-3 text-gray-600">{r._count.lines}</td>
                <td className="px-4 py-3 text-green-700">{r.matchedCount}</td>
                <td className="px-4 py-3 text-red-700">{r.chargebackCount || '—'}</td>
                <td className="px-4 py-3"><Link href={`/staff/remittances/${r.id}`} className="text-sm font-medium text-brand-700 hover:underline">{t('common.view')}</Link></td>
              </tr>
            ))}
            {remittances.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-500">{t('remit.list.empty')}</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
