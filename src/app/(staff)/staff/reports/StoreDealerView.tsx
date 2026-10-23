import type {
  StoreDealerReport,
  StoreGroup,
  StoreDealerStat,
  DealerStoreStat,
} from '@/lib/reporting/storeDealer';
import { ReportPrintButton } from './ReportPrintButton';
import {
  ReportHeader,
  ReportTile,
  ReportTiles,
  ReportTableWrap,
  ReportStamp,
  reportTheadRow,
  reportTh,
  reportThRight,
  reportTd,
  reportTdRight,
  reportTfootRow,
  reportRowZebra,
  reportGeneratedLabel,
} from '@/components/reporting/kit';

const money = (n: number) =>
  `$${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const money0 = (n: number) => `$${Math.round(n).toLocaleString('en-CA')}`;

function monthYear(d: Date | null): string {
  return d ? d.toLocaleDateString('en-CA', { month: 'short', year: 'numeric' }) : '—';
}

/** "Mar 2024 – Jul 2026" (or a single month when first and last land together). */
function span(first: Date | null, last: Date | null): string {
  const a = monthYear(first);
  const b = monthYear(last);
  if (a === '—' && b === '—') return '—';
  return a === b ? a : `${a} – ${b}`;
}

function ArchivedTag() {
  return (
    <span className="ml-1.5 rounded-full bg-gray-200 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-gray-600">
      archived
    </span>
  );
}

/** The per-office rows under one store (used both on its own and in the overview). */
function StoreDealerTable({ dealers }: { dealers: StoreDealerStat[] }) {
  const totalDeals = dealers.reduce((a, d) => a + d.deals, 0);
  const totalGross = dealers.reduce((a, d) => a + d.gross, 0);
  const totalPaid = dealers.reduce((a, d) => a + d.paidGross, 0);
  return (
    <ReportTableWrap>
      <table className="min-w-full text-sm">
        <thead>
          <tr className={reportTheadRow}>
            <th className={reportTh}>Office / Dealer</th>
            <th className={reportThRight}>Deals</th>
            <th className={reportThRight}>Units</th>
            <th className={reportThRight}>Sold $</th>
            <th className={reportThRight}>Paid $</th>
            <th className={reportTh}>Active at this store</th>
          </tr>
        </thead>
        <tbody>
          {dealers.map((d, i) => (
            <tr key={d.dealerId || '__unmatched__'} className={reportRowZebra(i)}>
              <td className={reportTd}>
                <span className="font-medium text-gray-900">{d.dealerName}</span>
                {d.archived && <ArchivedTag />}
              </td>
              <td className={reportTdRight}>{d.deals.toLocaleString('en-CA')}</td>
              <td className={reportTdRight}>{d.units.toLocaleString('en-CA')}</td>
              <td className={reportTdRight}>{money(d.gross)}</td>
              <td className={reportTdRight}>{money(d.paidGross)}</td>
              <td className={reportTd}>{span(d.firstSale, d.lastSale)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className={reportTfootRow}>
            <td className={`${reportTd} font-semibold`}>Total</td>
            <td className={`${reportTdRight} font-semibold`}>{totalDeals.toLocaleString('en-CA')}</td>
            <td className={reportTdRight} />
            <td className={`${reportTdRight} font-semibold`}>{money(totalGross)}</td>
            <td className={`${reportTdRight} font-semibold`}>{money(totalPaid)}</td>
            <td className={reportTd} />
          </tr>
        </tfoot>
      </table>
    </ReportTableWrap>
  );
}

function DealerStoreTable({ stores }: { stores: DealerStoreStat[] }) {
  const totalDeals = stores.reduce((a, s) => a + s.deals, 0);
  const totalGross = stores.reduce((a, s) => a + s.gross, 0);
  const totalPaid = stores.reduce((a, s) => a + s.paidGross, 0);
  return (
    <ReportTableWrap>
      <table className="min-w-full text-sm">
        <thead>
          <tr className={reportTheadRow}>
            <th className={reportTh}>Home Depot store</th>
            <th className={reportThRight}>Deals</th>
            <th className={reportThRight}>Units</th>
            <th className={reportThRight}>Sold $</th>
            <th className={reportThRight}>Paid $</th>
            <th className={reportTh}>Active span</th>
          </tr>
        </thead>
        <tbody>
          {stores.map((s, i) => (
            <tr key={s.storeNumber} className={reportRowZebra(i)}>
              <td className={`${reportTd} font-medium text-gray-900`}>{s.storeLabel}</td>
              <td className={reportTdRight}>{s.deals.toLocaleString('en-CA')}</td>
              <td className={reportTdRight}>{s.units.toLocaleString('en-CA')}</td>
              <td className={reportTdRight}>{money(s.gross)}</td>
              <td className={reportTdRight}>{money(s.paidGross)}</td>
              <td className={reportTd}>{span(s.firstSale, s.lastSale)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className={reportTfootRow}>
            <td className={`${reportTd} font-semibold`}>Total</td>
            <td className={`${reportTdRight} font-semibold`}>{totalDeals.toLocaleString('en-CA')}</td>
            <td className={reportTdRight} />
            <td className={`${reportTdRight} font-semibold`}>{money(totalGross)}</td>
            <td className={`${reportTdRight} font-semibold`}>{money(totalPaid)}</td>
            <td className={reportTd} />
          </tr>
        </tfoot>
      </table>
    </ReportTableWrap>
  );
}

export function StoreDealerView({ report }: { report: StoreDealerReport }) {
  const generated = reportGeneratedLabel();
  const yearsLabel =
    report.yearsRead.length > 1
      ? `${report.yearsRead[0]}–${report.yearsRead[report.yearsRead.length - 1]}`
      : String(report.yearsRead[0] ?? '');

  const scope =
    report.mode === 'store'
      ? report.storeGroup
        ? `Store: ${report.storeGroup.storeLabel}`
        : 'Every Home Depot store · each office that sold there'
      : report.dealerGroup
        ? `Office: ${report.dealerGroup.dealerName}`
        : 'Pick an office to see every store it sold at';

  return (
    <div className="print-sheet space-y-5">
      <style>{`@media print { @page { size: landscape; margin: 0; } }`}</style>

      <ReportHeader
        title="Store ↔ Dealer"
        sub="Who sold at which Home Depot store, from the sales journals"
        scope={scope}
        generated={`Journals ${yearsLabel} · Generated ${generated}`}
        actions={<ReportPrintButton />}
      />

      {report.error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {report.error}
        </div>
      )}

      {/* ---- By store, one store selected ---- */}
      {report.mode === 'store' && report.storeGroup && (
        <>
          <ReportTiles cols={4}>
            <ReportTile label="Offices here" value={report.storeGroup.dealers.length} />
            <ReportTile label="Total deals" value={report.storeGroup.totalDeals.toLocaleString('en-CA')} />
            <ReportTile label="Total sold" value={money0(report.storeGroup.totalGross)} />
            <ReportTile
              label="Current / most recent"
              value={<span className="text-base">{report.storeGroup.dealers[0]?.dealerName ?? '—'}</span>}
              sub={report.storeGroup.dealers[0] ? span(report.storeGroup.dealers[0].firstSale, report.storeGroup.dealers[0].lastSale) : undefined}
            />
          </ReportTiles>
          {report.storeGroup.dealers.length > 1 && (
            <p className="text-sm text-gray-600">
              This store has been sold by <strong>{report.storeGroup.dealers.length} different offices</strong>.
              Each row is that office’s own sales — a store that changed hands shows every office that worked it, newest first.
            </p>
          )}
          <StoreDealerTable dealers={report.storeGroup.dealers} />
        </>
      )}

      {/* ---- By store, overview (handover timeline across all stores) ---- */}
      {report.mode === 'store' && !report.storeGroup && (
        <>
          <ReportTiles cols={3}>
            <ReportTile label="Stores" value={report.allStores.length} />
            <ReportTile
              label="Stores shared by 2+ offices"
              value={report.allStores.filter((s) => s.dealers.length > 1).length}
            />
            <ReportTile label="Total sold" value={money0(report.allStores.reduce((a, s) => a + s.totalGross, 0))} />
          </ReportTiles>
          <p className="text-sm text-gray-600">
            Every Home Depot store and each office that has sold there, newest-active first. Stores worked by more than
            one office over time are flagged — that is the handover trail (e.g. a store that moved from one office to
            another). Pick a single store above for its full breakdown.
          </p>
          <div className="space-y-5">
            {report.allStores.map((s: StoreGroup) => (
              <div key={s.storeNumber} className="space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-sm font-bold text-gray-900">
                    {s.storeLabel}
                    {s.dealers.length > 1 && (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                        {s.dealers.length} offices
                      </span>
                    )}
                  </h3>
                  <span className="text-xs text-gray-500 tabular-nums">
                    {s.totalDeals.toLocaleString('en-CA')} deals · {money0(s.totalGross)}
                  </span>
                </div>
                <StoreDealerTable dealers={s.dealers} />
              </div>
            ))}
            {report.allStores.length === 0 && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                No store sales found in the journals.
              </div>
            )}
          </div>
        </>
      )}

      {/* ---- By dealer, one office selected ---- */}
      {report.mode === 'dealer' && report.dealerGroup && (
        <>
          <ReportTiles cols={4}>
            <ReportTile
              label="Office"
              value={<span className="text-base">{report.dealerGroup.dealerName}</span>}
              sub={report.dealerGroup.archived ? 'Archived dealer' : undefined}
            />
            <ReportTile label="Stores sold at" value={report.dealerGroup.stores.length} />
            <ReportTile label="Total deals" value={report.dealerGroup.totalDeals.toLocaleString('en-CA')} />
            <ReportTile label="Total sold" value={money0(report.dealerGroup.totalGross)} />
          </ReportTiles>
          <DealerStoreTable stores={report.dealerGroup.stores} />
        </>
      )}

      {/* ---- By dealer, nothing selected ---- */}
      {report.mode === 'dealer' && !report.dealerGroup && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
          Pick an office above to see every Home Depot store it sold at, with deals, dollars and the date span it was
          active at each.
        </div>
      )}

      <ReportStamp brand="GWA Portal · Georgian Water & Air" generated={generated} />
    </div>
  );
}
