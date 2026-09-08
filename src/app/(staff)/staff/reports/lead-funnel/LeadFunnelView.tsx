import type { LeadsReport } from '@/lib/reporting/leadsReport';
import { getT } from '@/i18n/server';
import type { TFunction } from '@/i18n/translator';

const pct = (n: number, d: number): number => (d > 0 ? Math.round((n / d) * 100) : 0);

function Stage({ label, value, share, width }: { label: string; value: number; share: number; width: number }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium text-gray-800">{label}</span>
        <span className="tabular-nums text-gray-600">{value.toLocaleString('en-US')} · {share}%</span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full bg-[#b8860b]" style={{ width: `${Math.max(2, width)}%` }} />
      </div>
    </div>
  );
}

export function LeadFunnelView({ report }: { report: LeadsReport }) {
  const t: TFunction = getT();

  if (!report.configured) {
    return <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{t('leadFunnel.notConnected')}</div>;
  }
  if (report.error) {
    return <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{t('leadFunnel.readError', { error: report.error })}</div>;
  }

  const g = report.group.outcomes;
  const total = report.group.total;
  const contacted = g.spoke + g.booked + g.sold;
  const bookedPlus = g.booked + g.sold;
  const sold = g.sold;
  const conv = pct(sold, total);

  return (
    <div className="space-y-5">
      {/* Conversion KPI */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#8a6508] via-[#b8860b] to-[#7a5606] shadow-sm">
        <div className="grid grid-cols-1 divide-y divide-white/15 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="px-5 py-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/80">{t('leadFunnel.conversion')}</div>
            <div className="text-4xl font-extrabold leading-none text-white">{conv}%</div>
            <div className="mt-1 text-xs text-white/80">{t('leadFunnel.soldOfLeads', { sold, total })}</div>
          </div>
          <div className="px-5 py-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/80">{t('leadFunnel.leads')}</div>
            <div className="text-3xl font-extrabold leading-none text-white">{total.toLocaleString('en-US')}</div>
            {report.group.noGood > 0 && <div className="mt-1 text-xs text-white/80">{t('leadFunnel.noGood', { n: report.group.noGood })}</div>}
          </div>
          <div className="px-5 py-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/80">{t('leadFunnel.contactRate')}</div>
            <div className="text-3xl font-extrabold leading-none text-white">{pct(contacted, total)}%</div>
          </div>
        </div>
      </div>

      {/* Funnel bars */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-gray-900">{t('leadFunnel.stages')}</h2>
        <div className="space-y-3">
          <Stage label={t('leadFunnel.stageLeads')} value={total} share={100} width={100} />
          <Stage label={t('leadFunnel.stageContacted')} value={contacted} share={pct(contacted, total)} width={pct(contacted, total)} />
          <Stage label={t('leadFunnel.stageBooked')} value={bookedPlus} share={pct(bookedPlus, total)} width={pct(bookedPlus, total)} />
          <Stage label={t('leadFunnel.stageSold')} value={sold} share={pct(sold, total)} width={pct(sold, total)} />
        </div>
      </div>

      {/* Per-dealer conversion */}
      {report.dealers.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
                  <th className="px-3 py-2 text-left font-medium">{t('leadFunnel.colOffice')}</th>
                  <th className="px-2 py-2 text-right font-medium">{t('leadFunnel.colLeads')}</th>
                  <th className="px-2 py-2 text-right font-medium">{t('leadFunnel.colContacted')}</th>
                  <th className="px-2 py-2 text-right font-medium">{t('leadFunnel.colBooked')}</th>
                  <th className="px-2 py-2 text-right font-medium">{t('leadFunnel.colSold')}</th>
                  <th className="px-2 py-2 text-right font-medium">{t('leadFunnel.colConv')}</th>
                </tr>
              </thead>
              <tbody>
                {report.dealers
                  .slice()
                  .sort((a, b) => pct(b.outcomes.sold, b.total) - pct(a.outcomes.sold, a.total) || b.total - a.total)
                  .map((d) => {
                    const dc = d.outcomes.spoke + d.outcomes.booked + d.outcomes.sold;
                    return (
                      <tr key={d.dealerId ?? d.dealerName} className="border-t border-gray-100">
                        <td className="px-3 py-2 text-left font-semibold text-gray-900">{d.dealerName}</td>
                        <td className="px-2 py-2 text-right tabular-nums text-gray-800">{d.total}</td>
                        <td className="px-2 py-2 text-right tabular-nums text-gray-800">{dc}</td>
                        <td className="px-2 py-2 text-right tabular-nums text-gray-800">{d.outcomes.booked + d.outcomes.sold}</td>
                        <td className="px-2 py-2 text-right tabular-nums text-gray-800">{d.outcomes.sold}</td>
                        <td className="px-2 py-2 text-right tabular-nums font-semibold text-gray-900">{pct(d.outcomes.sold, d.total)}%</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400">{t('leadFunnel.basisNote')}</p>
    </div>
  );
}
