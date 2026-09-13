import type { ProductMixReport } from '@/lib/reporting/productMix';
import { getT } from '@/i18n/server';
import { ReportHeader, ReportTile, ReportTiles, ReportStamp, reportGeneratedLabel } from '@/components/reporting/kit';

function money(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-US');
}

export function ProductMixView({ report, org, orgLogoUrl }: { report: ProductMixReport; org?: string; orgLogoUrl?: string | null }) {
  const t = getT();

  if (report.totalDeals === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
        {report.error ? t('productMix.readError', { error: report.error }) : t('productMix.noDeals')}
      </div>
    );
  }

  const top = report.products[0]?.deals ?? 1;

  return (
    <div className="space-y-5">
      <ReportHeader
        org={org}
        logoUrl={orgLogoUrl}
        title={t('productMix.title')}
        scope={t('productMix.subtitle')}
        generated={t('reportStamp.generated', { date: reportGeneratedLabel() })}
      />

      <ReportTiles cols={3}>
        <ReportTile label={t('productMix.totalDeals')} value={report.totalDeals.toLocaleString('en-US')} />
        <ReportTile label={t('productMix.avgPerDeal')} value={report.avgProductsPerDeal} sub={t('productMix.avgPerDealSub')} />
        <ReportTile label={t('productMix.distinctProducts')} value={report.products.length} />
      </ReportTiles>

      {/* Product bars */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-base font-semibold text-gray-900">{t('productMix.byProduct')}</h2>
        <p className="mb-4 text-xs text-gray-400">{t('productMix.byProductHint')}</p>
        <div className="space-y-2.5">
          {report.products.map((p) => (
            <div key={p.code}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium text-gray-800">{p.code}</span>
                <span className="tabular-nums text-gray-600">{p.deals} · {p.sharePct}% · {money(p.gross)}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full bg-[#123448]" style={{ width: `${Math.max(2, Math.round((p.deals / top) * 100))}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-400">{t('productMix.basisNote')}</p>

      <ReportStamp brand={t('reportStamp.brand')} generated={t('reportStamp.generated', { date: reportGeneratedLabel() })} />
    </div>
  );
}
