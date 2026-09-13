import { ReportTile, ReportTiles, reportTheadRow } from './kit';
import type { DealerDigest } from '@/lib/reporting/dealerDigest';

const money = (n: number) => `$${Math.round(n).toLocaleString('en-CA')}`;

function Delta({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-blue-600">New</span>;
  if (pct === 0) return <span className="text-gray-400">no change</span>;
  const up = pct > 0;
  return (
    <span className={up ? 'text-emerald-600' : 'text-red-600'}>
      {up ? '▲' : '▼'} {Math.abs(pct)}% vs last
    </span>
  );
}

function Sparkbars({ points }: { points: { label: string; total: number }[] }) {
  if (points.length === 0) return null;
  const W = 680;
  const H = 120;
  const padB = 18;
  const plotH = H - padB - 6;
  const max = Math.max(1, ...points.map((p) => p.total));
  const slot = W / points.length;
  const bw = Math.min(slot * 0.6, 40);
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Lead trend">
        {points.map((p, i) => {
          const h = (p.total / max) * plotH;
          const x = i * slot + (slot - bw) / 2;
          const y = 6 + plotH - h;
          return (
            <g key={i}>
              <rect x={x} y={y} width={bw} height={Math.max(0, h)} rx="2" fill={i === points.length - 1 ? '#2563eb' : '#93c5fd'} />
              {p.total > 0 && <text x={x + bw / 2} y={y - 3} textAnchor="middle" fontSize="9" fill="#374151" fontWeight="600">{p.total}</text>}
              <text x={x + bw / 2} y={H - 5} textAnchor="middle" fontSize="8.5" fill="#6b7280">{p.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** One-glance office snapshot: highlights, leads (+trend), financing mix, VOC. */
export function DealerDigestView({ digest }: { digest: DealerDigest }) {
  const d = digest;
  return (
    <div className="space-y-5">
      {d.highlights.length > 0 && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4">
          <ul className="space-y-1 text-sm text-[#0e2756]">
            {d.highlights.map((h, i) => (
              <li key={i}>• {h}</li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-500">Leads</h3>
        <ReportTiles cols={4}>
          <ReportTile label="Leads received" value={d.leads.total} sub={<Delta pct={d.leads.deltaPct} />} />
          <ReportTile label="Contacted" value={d.leads.contacted} sub={d.leads.total ? `${Math.round((d.leads.contacted / d.leads.total) * 100)}%` : '—'} />
          <ReportTile label="Booked / sold" value={d.leads.bookedSold} />
          <ReportTile label="No good" value={d.leads.noGood} />
        </ReportTiles>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <h3 className="mb-1 text-base font-bold text-gray-900">Lead volume ({d.period === 'week' ? 'last 8 weeks' : 'last 8 months'})</h3>
        <Sparkbars points={d.trend} />
      </div>

      <div>
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-500">Financing</h3>
        <ReportTiles cols={4}>
          <ReportTile label="Funded this period" value={money(d.financing.fundedTotal)} sub={`${d.financing.fundedDeals} paid deal${d.financing.fundedDeals === 1 ? '' : 's'}`} />
          <ReportTile label="Financed (loans)" value={d.financing.financed} sub={`FinanceIt ${d.financing.financeIt}`} />
          <ReportTile label="HD Credit Cards" value={d.financing.hdCreditCards} />
          <ReportTile label="Cash / other" value={d.financing.cashOther} sub={`${d.financing.okDeals} confirmed deals`} />
        </ReportTiles>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-500">Voice of the Customer</h3>
        <ReportTiles cols={3}>
          <ReportTile label="VOCs completed" value={d.voc.completed} />
          <ReportTile label="Avg rating" value={d.voc.avgRating != null ? d.voc.avgRating.toFixed(2) : '—'} />
          <ReportTile label="Top reps" value={d.voc.topReps.length ? d.voc.topReps[0].rep : '—'} sub={d.voc.topReps.length ? `${d.voc.topReps[0].count} VOCs` : undefined} />
        </ReportTiles>
        {d.voc.topReps.length > 1 && (
          <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-sm">
              <thead>
                <tr className={reportTheadRow}>
                  <th className="px-4 py-2.5">Sales rep</th>
                  <th className="px-4 py-2.5 text-right">VOCs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {d.voc.topReps.map((r, i) => (
                  <tr key={i} className={i % 2 ? 'bg-gray-50/40' : ''}>
                    <td className="px-4 py-2 font-medium text-gray-800">{r.rep}</td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums text-gray-900">{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {d.leads.byKind.length > 0 && (
        <p className="text-xs text-gray-500">
          Top lead types: {d.leads.byKind.map((k) => `${k.kind} (${k.count})`).join(' · ')}
        </p>
      )}
    </div>
  );
}
