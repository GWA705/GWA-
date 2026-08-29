'use client';

import { useEffect, useState } from 'react';
import { CustomerSearch } from './CustomerSearch';

const RECENT_KEY = 'gwa.recentCustomerSearches';

/**
 * Dealer "Find a customer" screen. One focused hero: a mode toggle picks the
 * job (pull up your own deals vs. find which office already has a customer) and
 * reshapes the field + hint; recent lookups become one-tap chips. Both modes run
 * the same office-scoped search — the toggle is guidance, not a different query.
 */
export function FindCustomerPanel({ companyName }: { companyName: string }) {
  const [mode, setMode] = useState<'mine' | 'whose'>('mine');
  const [recent, setRecent] = useState<string[]>([]);
  const [push, setPush] = useState<{ q: string; nonce: number } | undefined>();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      if (raw) setRecent(JSON.parse(raw));
    } catch {
      /* private mode / blocked storage — no recents, that's fine */
    }
  }, []);

  const record = (q: string) => {
    setRecent((prev) => {
      const next = [q, ...prev.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 6);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };
  const clearRecent = () => {
    setRecent([]);
    try {
      localStorage.removeItem(RECENT_KEY);
    } catch {
      /* ignore */
    }
  };

  const placeholder = mode === 'whose' ? 'Exact phone number…' : 'Name or phone number…';

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 via-white to-white p-6 shadow-sm dark:bg-none dark:bg-[var(--d-surface)] sm:p-7">
        {/* Decorative search rings (light, corner) */}
        <svg width="170" height="170" viewBox="0 0 170 170" aria-hidden="true"
          className="pointer-events-none absolute -right-8 -top-8 text-brand-100 opacity-70">
          <circle cx="80" cy="80" r="34" fill="none" stroke="currentColor" strokeWidth="9" />
          <circle cx="80" cy="80" r="58" fill="none" stroke="currentColor" strokeWidth="9" opacity="0.6" />
          <line x1="104" y1="104" x2="138" y2="138" stroke="currentColor" strokeWidth="11" strokeLinecap="round" />
        </svg>

        <div className="relative">
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Find a customer</h1>
          <p className="mt-0.5 text-sm text-gray-600">
            Pull up your {companyName} deals, or see which office already has a customer.
          </p>

          {/* Mode toggle */}
          <div className="mt-4 inline-flex w-full max-w-sm rounded-xl bg-brand-100/70 p-1">
            {([['mine', 'My customers'], ['whose', 'Whose customer?']] as const).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                  mode === m ? 'bg-white text-brand-700 shadow-sm' : 'text-brand-700/80 hover:text-brand-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-3">
            <CustomerSearch mode="dealer" placeholder={placeholder} large onSearch={record} pushQuery={push} />
          </div>

          <p className="mt-2.5 text-sm text-gray-500">
            {mode === 'whose' ? (
              <>Enter a customer&apos;s <strong>exact phone number</strong> to see which office already has them, so you can reach out.</>
            ) : (
              <>Search your own deals by <strong>name or phone number</strong>.</>
            )}
          </p>
        </div>
      </section>

      {recent.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Recent lookups</span>
            <button type="button" onClick={clearRecent} className="text-xs text-gray-400 hover:text-gray-600 hover:underline">Clear</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recent.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setPush({ q, nonce: Date.now() })}
                className="inline-flex items-center gap-1.5 rounded-full border border-brand-100 bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100"
              >
                <span aria-hidden>{/^[+(\d]/.test(q) ? '📞' : '👤'}</span>
                <span className="max-w-[12rem] truncate">{q}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400">
        Searches are logged. Only your own office&apos;s customers show full details — other offices show contact info only.
      </p>
    </div>
  );
}
