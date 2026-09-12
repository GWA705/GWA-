'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { StoreRow, StoreSale } from '@/lib/reporting/monthly';
import { useT } from '@/i18n/client';
import type { TFunction } from '@/i18n/translator';
import { reportTheadRow } from '@/components/reporting/kit';

// Interactive store table + mobile cards for the monthly report. Clicking a store
// expands the individual paid-OK sales behind its "This month" number; each sale
// links to Find a customer (pre-filled) so the reviewer can open that customer.

function money(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-US');
}

function Pct({ value, t }: { value: number | null; t: TFunction }) {
  if (value === null) return <span className="font-semibold text-emerald-600">{t('reports.monthly.newBadge')}</span>;
  const up = value >= 0;
  return <span className={`font-semibold ${up ? 'text-emerald-600' : 'text-red-600'}`}>{up ? '+' : ''}{value}%</span>;
}

function splitStore(store: string, label: string): { num: string; name: string | null } {
  const m = label.match(/^(\S+)\s*[—-]\s*(.+)$/);
  if (m) return { num: m[1], name: m[2] };
  return { num: store, name: label !== store ? label : null };
}

// Always route to Find a customer, pre-filled by phone (most precise) or name.
function findHref(sale: StoreSale): string {
  const q = (sale.phone || '').replace(/\D/g, '').length >= 7 ? sale.phone : sale.customerName;
  return `/staff/find-customer?q=${encodeURIComponent((q || '').trim())}`;
}

function fmtDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// The drill-down list of sales for one store, shared by table + card views.
function SalesList({ sales, t }: { sales: StoreSale[]; t: TFunction }) {
  if (sales.length === 0) {
    return <p className="px-4 py-3 text-xs text-gray-400">{t('reports.monthly.noSalesInMonth')}</p>;
  }
  return (
    <ul className="divide-y divide-gray-100">
      {sales.map((s, i) => (
        <li key={i}>
          <Link
            href={findHref(s)}
            className="flex items-center gap-3 px-4 py-2 text-sm transition hover:bg-blue-50"
          >
            <span className="min-w-0 flex-1 truncate font-medium text-gray-900">{s.customerName}</span>
            {s.product && <span className="hidden min-w-0 max-w-[40%] truncate text-xs text-gray-500 sm:inline">{s.product}</span>}
            {s.saleDate && <span className="hidden text-xs text-gray-400 sm:inline">{fmtDate(s.saleDate)}</span>}
            <span className="tabular-nums font-semibold text-gray-900">{money(s.amount)}</span>
            <ChevronRight size={14} className="flex-none text-blue-500" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function StoreTable({ stores, total }: { stores: StoreRow[]; total: StoreRow }) {
  const t = useT();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (store: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(store)) next.delete(store);
      else next.add(store);
      return next;
    });

  const cell = 'px-2 py-2 text-right tabular-nums';

  return (
    <>
      {/* Mobile: stacked cards, tap to expand. */}
      <div className="space-y-2 sm:hidden">
        {stores.map((r) => {
          const { num, name } = splitStore(r.store, r.label);
          const canExpand = (r.sales?.length ?? 0) > 0;
          const isOpen = open.has(r.store);
          return (
            <div key={r.store} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => canExpand && toggle(r.store)}
                className="w-full p-4 text-left"
                aria-expanded={isOpen}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {canExpand && <ChevronRight size={15} className={`text-gray-400 transition ${isOpen ? 'rotate-90' : ''}`} />}
                    <span className="rounded-md bg-[#F96302] px-2 py-0.5 font-mono text-xs font-bold text-white">{num}</span>
                    {name && <span className="font-semibold text-gray-900">{name}</span>}
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold tabular-nums text-gray-900">{money(r.curMonth)}</div>
                    <div className="text-[10px] uppercase text-gray-400">{t('reports.monthly.cardThisMonth')}</div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                  <Cell lbl={t('reports.monthly.colPrevMo')} node={money(r.prevMonth)} />
                  <Cell lbl={t('reports.monthly.colMoM')} node={<Pct value={r.momPct} t={t} />} />
                  <Cell lbl={t('reports.monthly.colLyMo')} node={money(r.lyMonth)} />
                  <Cell lbl={t('reports.monthly.colYoY')} node={<Pct value={r.yoyPct} t={t} />} />
                  <Cell lbl={t('reports.monthly.colYtd')} node={money(r.ytdTy)} />
                  <Cell lbl={t('reports.monthly.colYtdPct')} node={<Pct value={r.ytdPct} t={t} />} />
                </div>
                {canExpand && (
                  <div className="mt-2 text-[11px] font-semibold text-blue-600">
                    {isOpen ? t('reports.monthly.hideSales') : t('reports.monthly.viewSales', { count: r.sales!.length })}
                  </div>
                )}
              </button>
              {isOpen && r.sales && (
                <div className="border-t border-gray-100 bg-gray-50/60">
                  <SalesList sales={r.sales} t={t} />
                </div>
              )}
            </div>
          );
        })}
        <div className="rounded-2xl bg-slate-800 p-4 text-white">
          <div className="flex items-baseline justify-between">
            <div className="font-bold">{total.label}</div>
            <div className="text-lg font-bold tabular-nums">{money(total.curMonth)}</div>
          </div>
        </div>
      </div>

      {/* Tablet/desktop: full comparison table, click a row to drill in. */}
      <div className="hidden overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm sm:block">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className={reportTheadRow}>
                <th className="px-3 py-2 text-left font-medium">{t('reports.monthly.colStore')}</th>
                <th className="px-2 py-2 text-right font-medium">{t('reports.monthly.colPrevMo')}</th>
                <th className="px-2 py-2 text-right font-medium">{t('reports.monthly.colThisMo')}</th>
                <th className="px-2 py-2 text-right font-medium">{t('reports.monthly.colMoM')}</th>
                <th className="px-2 py-2 text-right font-medium hidden sm:table-cell">{t('reports.monthly.colLyMo')}</th>
                <th className="px-2 py-2 text-right font-medium hidden sm:table-cell">{t('reports.monthly.colYoY')}</th>
                <th className="px-2 py-2 text-right font-medium">{t('reports.monthly.colYtd')}</th>
                <th className="px-2 py-2 text-right font-medium hidden md:table-cell">{t('reports.monthly.colYtdLy')}</th>
                <th className="px-2 py-2 text-right font-medium">{t('reports.monthly.colYtdPct')}</th>
              </tr>
            </thead>
            <tbody>
              {stores.map((r) => {
                const canExpand = (r.sales?.length ?? 0) > 0;
                const isOpen = open.has(r.store);
                return (
                  <FragmentRow
                    key={r.store}
                    r={r}
                    t={t}
                    cell={cell}
                    canExpand={canExpand}
                    isOpen={isOpen}
                    onToggle={() => canExpand && toggle(r.store)}
                  />
                );
              })}
              <tr className="bg-slate-800">
                <td className="px-3 py-2 text-left font-bold text-white">{total.label}</td>
                <td className={`${cell} font-bold text-white`}>{money(total.prevMonth)}</td>
                <td className={`${cell} text-white`}>{money(total.curMonth)}</td>
                <td className={cell}><Pct value={total.momPct} t={t} /></td>
                <td className={`${cell} font-bold text-white hidden sm:table-cell`}>{money(total.lyMonth)}</td>
                <td className={`${cell} hidden sm:table-cell`}><Pct value={total.yoyPct} t={t} /></td>
                <td className={`${cell} font-bold text-white`}>{money(total.ytdTy)}</td>
                <td className={`${cell} font-bold text-white hidden md:table-cell`}>{money(total.ytdLy)}</td>
                <td className={cell}><Pct value={total.ytdPct} t={t} /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function Cell({ lbl, node }: { lbl: string; node: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[10px] uppercase tracking-wide text-gray-400">{lbl}</span>
      <span className="tabular-nums text-gray-900">{node}</span>
    </div>
  );
}

function FragmentRow({
  r,
  t,
  cell,
  canExpand,
  isOpen,
  onToggle,
}: {
  r: StoreRow;
  t: TFunction;
  cell: string;
  canExpand: boolean;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className={`border-t border-gray-100 ${canExpand ? 'cursor-pointer hover:bg-blue-50/50' : ''} ${isOpen ? 'bg-blue-50/50' : ''}`}
        onClick={onToggle}
      >
        <td className="px-3 py-2 text-left font-semibold text-gray-900">
          <span className="inline-flex items-center gap-1.5">
            {canExpand && <ChevronRight size={14} className={`text-gray-400 transition ${isOpen ? 'rotate-90' : ''}`} />}
            {r.label}
          </span>
        </td>
        <td className={`${cell} text-gray-800`}>{money(r.prevMonth)}</td>
        <td className={`${cell} font-semibold text-gray-900`}>{money(r.curMonth)}</td>
        <td className={cell}><Pct value={r.momPct} t={t} /></td>
        <td className={`${cell} text-gray-800 hidden sm:table-cell`}>{money(r.lyMonth)}</td>
        <td className={`${cell} hidden sm:table-cell`}><Pct value={r.yoyPct} t={t} /></td>
        <td className={`${cell} text-gray-800`}>{money(r.ytdTy)}</td>
        <td className={`${cell} text-gray-800 hidden md:table-cell`}>{money(r.ytdLy)}</td>
        <td className={cell}><Pct value={r.ytdPct} t={t} /></td>
      </tr>
      {isOpen && r.sales && (
        <tr className="border-t border-gray-100">
          <td colSpan={9} className="bg-gray-50/60 p-0">
            <div className="px-1 py-1">
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                {t('reports.monthly.salesBehind', { store: r.label })}
              </div>
              <SalesList sales={r.sales} t={t} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
