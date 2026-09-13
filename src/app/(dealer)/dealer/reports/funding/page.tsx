import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireDealerAccess } from '@/lib/session';
import { hasDealerReportAccess } from '@/lib/reporting/access';
import { prisma } from '@/lib/db';
import { buildFundingReport, weekWindow, monthWindow } from '@/lib/reporting/fundingReport';
import { DealerReportTabs } from '../DealerReportTabs';
import { ReportActions } from '../ReportActions';
import { ReportTile, ReportStamp, reportTheadRow } from '@/components/reporting/kit';
import { getDealerReportBrand } from '@/lib/reporting/dealerBrand';
import { getT } from '@/i18n/server';

export const dynamic = 'force-dynamic';

const money = (n: number) => `$${Math.round(n).toLocaleString('en-CA')}`;
const dt = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });

/** Dealer "Funding" — deals PAID to this office (by date paid, actual payout
 * amount), for the chosen week or month. High-level one-pager, printable and
 * emailable. Own office only. */
export default async function DealerFundingPage({ searchParams }: { searchParams: { p?: string; o?: string } }) {
  const user = await requireDealerAccess();
  if (!(await hasDealerReportAccess(user)) || !user.dealerId) notFound();

  const t = getT();
  const period: 'week' | 'month' = searchParams.p === 'month' ? 'month' : 'week';
  const offset = Number.parseInt(searchParams.o ?? '0', 10) || 0;
  const win = period === 'month' ? monthWindow(offset) : weekWindow(offset);
  const report = await buildFundingReport(win, { dealerId: user.dealerId });

  const dealer = await prisma.dealer.findUnique({ where: { id: user.dealerId }, select: { name: true } });
  const officeName = report.offices[0]?.dealerName || dealer?.name || 'Your office';
  const brand = await getDealerReportBrand(user.dealerId);
  const deals = report.offices[0]?.deals ?? [];

  const periodLabel =
    period === 'month'
      ? new Date(report.start).toLocaleDateString('en-CA', { month: 'long', year: 'numeric' })
      : report.label;
  const qp = (o: number) => `/dealer/reports/funding?p=${period}&o=${o}`;
  const generated = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });

  const tile = (label: string, value: string, sub?: string) => <ReportTile label={label} value={value} sub={sub} />;

  return (
    <div className="space-y-5">
      <DealerReportTabs active="funding" />

      {/* Controls (not printed) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-sm">
            <Link href="/dealer/reports/funding?p=week&o=0" className={`rounded-md px-3 py-1 font-semibold ${period === 'week' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'}`}>{t('funding.week')}</Link>
            <Link href="/dealer/reports/funding?p=month&o=0" className={`rounded-md px-3 py-1 font-semibold ${period === 'month' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'}`}>{t('funding.month')}</Link>
          </div>
          <Link href={qp(offset - 1)} className="btn-secondary text-sm">←</Link>
          {offset < 0 && <Link href={qp(offset + 1)} className="btn-secondary text-sm">→</Link>}
        </div>
        <ReportActions title={t('reports.tabFunding')} />
      </div>

      {/* The printable one-pager */}
      <div className="print-sheet space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b-[3px] border-[#123448] pb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              {brand.logoUrl ? (
                <img src={brand.logoUrl} alt="" className="h-9 w-9 flex-none rounded object-contain" />
              ) : (
                <img src="/brand/gwa-icon.png" alt="" className="h-9 w-9 flex-none" />
              )}
              <div className="text-sm font-bold uppercase tracking-wide text-gray-700">{brand.name}</div>
            </div>
            <h1 className="mt-2.5 text-2xl font-bold text-gray-900">{t('funding.title')}</h1>
            <p className="mt-0.5 text-sm text-gray-600">{officeName} · <span className="font-medium">{periodLabel}</span></p>
          </div>
          <div className="text-right text-xs text-gray-400">{t('funding.generated')} {generated}</div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {tile(t('funding.dealsPaid'), String(report.count), periodLabel)}
          {tile(t('funding.paidToYou'), money(report.total))}
          {tile(t('funding.awaiting'), String(report.pipeline.count), report.pipeline.total > 0 ? money(report.pipeline.total) : undefined)}
        </div>

        {deals.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">{t('funding.none')}</div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-sm">
              <thead>
                <tr className={reportTheadRow}>
                  <th className="px-4 py-3">{t('funding.colCustomer')}</th>
                  <th className="px-4 py-3">{t('funding.colHd')}</th>
                  <th className="px-4 py-3">{t('funding.colPaidOn')}</th>
                  <th className="px-4 py-3 text-right">{t('funding.colAmount')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {deals.map((d, i) => (
                  <tr key={d.applicationId} className={i % 2 ? 'bg-gray-50/40' : ''}>
                    <td className="px-4 py-2.5 font-medium text-gray-800">
                      <Link href={`/dealer/applications/${d.applicationId}`} className="hover:underline">{d.customer}</Link>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{d.hdReference ?? '—'}</td>
                    <td className="px-4 py-2.5 text-gray-600">{dt(d.paidOn)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-gray-900">{money(d.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 bg-gray-100">
                  <td className="px-4 py-3 font-bold text-gray-800" colSpan={3}>{t('funding.total')}</td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums text-gray-900">{money(report.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <p className="text-xs text-gray-400">{t('funding.basis')}</p>

        <ReportStamp brand={t('reportStamp.brand')} generated={t('reportStamp.generated', { date: generated })} />
      </div>
    </div>
  );
}
