'use client';

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { LeaderboardRow } from '@/lib/reporting/salespersonLeaderboard';
import { useT } from '@/i18n/client';

function money(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-US');
}

const RANK_STYLE = ['bg-[#F96302] text-white', 'bg-slate-400 text-white', 'bg-amber-700 text-white'];

// Leaderboard table. Rows built from a canonical rep key, so near-duplicate
// spellings ("Nick F" / "Nick.f", "Brynn/Alex" / "Alex/Brynn") are already merged.
// A row combining more than one spelling can be expanded to show exactly what was
// grouped — so an accidental merge is easy to spot.
export function LeaderboardTable({ rows }: { rows: LeaderboardRow[] }) {
  const t = useT();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (name: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
              <th className="px-3 py-2 text-left font-medium">#</th>
              <th className="px-3 py-2 text-left font-medium">{t('leaderboard.colRep')}</th>
              <th className="px-2 py-2 text-right font-medium">{t('leaderboard.colDeals')}</th>
              <th className="px-2 py-2 text-right font-medium">{t('leaderboard.colUnits')}</th>
              <th className="px-2 py-2 text-right font-medium">{t('leaderboard.colAvg')}</th>
              <th className="px-2 py-2 text-right font-medium">{t('leaderboard.colVolume')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const merged = r.variants.length > 1;
              const isOpen = open.has(r.name);
              return (
                <ExpandRow
                  key={r.name + i}
                  r={r}
                  i={i}
                  merged={merged}
                  isOpen={isOpen}
                  onToggle={() => merged && toggle(r.name)}
                  t={t}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExpandRow({
  r,
  i,
  merged,
  isOpen,
  onToggle,
  t,
}: {
  r: LeaderboardRow;
  i: number;
  merged: boolean;
  isOpen: boolean;
  onToggle: () => void;
  t: ReturnType<typeof useT>;
}) {
  return (
    <>
      <tr
        className={`border-t border-gray-100 ${merged ? 'cursor-pointer hover:bg-blue-50/50' : ''} ${isOpen ? 'bg-blue-50/50' : ''}`}
        onClick={onToggle}
      >
        <td className="px-3 py-2">
          <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${RANK_STYLE[i] ?? 'bg-gray-100 text-gray-600'}`}>{i + 1}</span>
        </td>
        <td className="px-3 py-2 text-left font-semibold text-gray-900">
          <span className="inline-flex items-center gap-1.5">
            {merged && <ChevronRight size={13} className={`text-gray-400 transition ${isOpen ? 'rotate-90' : ''}`} />}
            {r.name}
            {merged && (
              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                {t('leaderboard.namesMerged', { n: r.variants.length })}
              </span>
            )}
          </span>
        </td>
        <td className="px-2 py-2 text-right tabular-nums text-gray-800">{r.deals}</td>
        <td className="px-2 py-2 text-right tabular-nums text-gray-800">{r.units > 0 ? r.units : '—'}</td>
        <td className="px-2 py-2 text-right tabular-nums text-gray-800">{r.avgDeal > 0 ? money(r.avgDeal) : '—'}</td>
        <td className="px-2 py-2 text-right tabular-nums font-semibold text-gray-900">{money(r.volume)}</td>
      </tr>
      {merged && isOpen && (
        <tr className="border-t border-gray-100">
          <td colSpan={6} className="bg-gray-50/60 px-4 py-2">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              {t('leaderboard.mergedInto')}
            </div>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700">
              {r.variants.map((v) => (
                <li key={v.name} className="tabular-nums">
                  <span className="font-medium text-gray-900">{v.name}</span> · {v.deals}
                </li>
              ))}
            </ul>
          </td>
        </tr>
      )}
    </>
  );
}
