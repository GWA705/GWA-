'use client';

import { useMemo, useState } from 'react';
import type { PricingDeal } from '@/lib/reporting/productPricing';

const money = (n: number) => `$${n.toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

type Mode = 'exact' | 'includes';

/**
 * Manual grouping: pick the products you want to analyse together and see the
 * average sale price when they were sold together. "Exactly" matches deals whose
 * product set is precisely your selection (a true package); "Includes" matches
 * any deal that contains all the picked products (plus possibly others). Runs in
 * the browser over the already-loaded deals — instant, no round-trips.
 */
export function ManualPackageBuilder({ deals, products }: { deals: PricingDeal[]; products: string[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<Mode>('exact');

  // Pre-lowercase each deal's product set once.
  const dealSets = useMemo(
    () => deals.map((d) => ({ set: new Set(d.products.map((p) => p.toLowerCase())), amount: d.amount, approved: d.approved, installed: d.installed })),
    [deals],
  );

  function toggle(p: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      const key = p.toLowerCase();
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const result = useMemo(() => {
    if (selected.size === 0) return null;
    const sel = selected;
    const matched = dealSets.filter((d) => {
      if (mode === 'exact') {
        if (d.set.size !== sel.size) return false;
        for (const k of sel) if (!d.set.has(k)) return false;
        return true;
      }
      for (const k of sel) if (!d.set.has(k)) return false;
      return true;
    });
    const sold = matched.length;
    const approved = matched.filter((m) => m.approved).length;
    const installed = matched.filter((m) => m.installed).length;
    // Average uses approved deals with a real amount (falls back to any matched).
    const priced = matched.filter((m) => m.approved && m.amount > 0).map((m) => m.amount);
    const amounts = priced.length ? priced : matched.filter((m) => m.amount > 0).map((m) => m.amount);
    const total = amounts.reduce((s, a) => s + a, 0);
    return {
      sold,
      approved,
      installed,
      count: amounts.length,
      avg: amounts.length ? total / amounts.length : 0,
    };
  }, [dealSets, selected, mode]);

  return (
    <section className="overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 bg-blue-50/60 px-5 py-3">
        <h3 className="text-base font-bold text-gray-900">Group products your way</h3>
        <p className="text-xs text-gray-500">Tick the products you sell together to see the average sale price for that combination.</p>
      </div>

      <div className="space-y-4 p-5">
        {products.length === 0 ? (
          <p className="text-sm text-gray-500">No products in range yet.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {products.map((p) => {
                const on = selected.has(p.toLowerCase());
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => toggle(p)}
                    aria-pressed={on}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                      on ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1 text-sm">
                <button type="button" onClick={() => setMode('exact')} className={`rounded-md px-3 py-1 font-semibold ${mode === 'exact' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'}`}>Exactly these</button>
                <button type="button" onClick={() => setMode('includes')} className={`rounded-md px-3 py-1 font-semibold ${mode === 'includes' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'}`}>Includes these</button>
              </div>
              {selected.size > 0 && (
                <button type="button" onClick={() => setSelected(new Set())} className="text-xs font-semibold text-gray-400 hover:text-red-600">Clear</button>
              )}
            </div>

            {result === null ? (
              <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">
                Pick one or more products above to see the average.
              </p>
            ) : result.sold === 0 ? (
              <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                No deals {mode === 'exact' ? 'sold exactly this set' : 'included all of these'} yet.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Avg sale price" value={result.count ? money(result.avg) : '—'} strong />
                <Stat label="Sold" value={String(result.sold)} />
                <Stat label="Approved" value={String(result.approved)} />
                <Stat label="Installed" value={String(result.installed)} />
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`mt-0.5 tabular-nums ${strong ? 'text-xl font-bold text-gray-900' : 'text-lg font-semibold text-gray-700'}`}>{value}</div>
    </div>
  );
}
