import { notFound } from 'next/navigation';
import { Download, FileSpreadsheet } from 'lucide-react';
import { requireDealerAccess } from '@/lib/session';
import { canViewOwnerPricingReport } from '@/lib/reporting/access';
import { getDealerReportBrand } from '@/lib/reporting/dealerBrand';
import { ReportHeader, ReportStamp, reportGeneratedLabel } from '@/components/reporting/kit';
import { DealerReportTabs } from '../DealerReportTabs';
import { getT } from '@/i18n/server';

export const dynamic = 'force-dynamic';

function ym(offsetMonths: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + offsetMonths);
  return d.toISOString().slice(0, 10);
}

/**
 * Accounting export (distributor / office owner only). Pick a date range and
 * download a CSV with one row per deal and the full EFT payout breakdown, for
 * an accounting team to reconcile. The heavy lifting is in the CSV route.
 */
export default async function AccountingExportPage() {
  const user = await requireDealerAccess();
  if (!(await canViewOwnerPricingReport(user)) || !user.dealerId) notFound();
  const t = getT();
  const brand = await getDealerReportBrand(user.dealerId);

  const firstOfMonth = new Date();
  firstOfMonth.setDate(1);
  const from = firstOfMonth.toISOString().slice(0, 10);
  const to = ym(0);

  return (
    <div className="space-y-5">
      <DealerReportTabs active="accounting" showOwner />

      <ReportHeader
        org={brand.name}
        logoUrl={brand.logoUrl}
        title={t('reports.tabAccounting')}
        generated={t('reportStamp.generated', { date: reportGeneratedLabel() })}
      />

      <section className="card p-6">
        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <FileSpreadsheet size={22} />
          </span>
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-slate-100">{t('reports.acctTitle')}</h2>
            <p className="text-sm text-gray-500">{t('reports.acctBody')}</p>
          </div>
        </div>

        <form action="/api/dealer/accounting-export" method="get" className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label" htmlFor="from">{t('reports.acctFrom')}</label>
            <input type="date" id="from" name="from" defaultValue={from} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="to">{t('reports.acctTo')}</label>
            <input type="date" id="to" name="to" defaultValue={to} className="input" />
          </div>
          <button type="submit" className="btn-primary inline-flex items-center gap-2">
            <Download size={16} /> {t('reports.downloadCsv')}
          </button>
        </form>

        <p className="mt-3 text-xs text-gray-400">{t('reports.acctNote')}</p>
      </section>

      <ReportStamp brand={t('reportStamp.brand')} generated={t('reportStamp.generated', { date: reportGeneratedLabel() })} />
    </div>
  );
}
