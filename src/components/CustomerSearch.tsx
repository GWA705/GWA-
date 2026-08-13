'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { customerSearchAction } from '@/app/(dealer)/dealer/find-customer/actions';
import type { CustomerSearchResult } from '@/lib/customerSearch';

export function CustomerSearch({ mode }: { mode: 'internal' | 'dealer' }) {
  const live = mode === 'internal'; // GWA team gets live typeahead
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<CustomerSearchResult | null>(null);
  const [pending, start] = useTransition();
  const seq = useRef(0);

  function run(q: string) {
    if (q.trim().length < 3) {
      setResult(null);
      return;
    }
    const mine = ++seq.current;
    start(async () => {
      const r = await customerSearchAction(q);
      // Ignore out-of-order responses from earlier keystrokes.
      if (mine === seq.current) setResult(r);
    });
  }

  // Live typeahead (internal): debounce keystrokes; fire at 3+ chars.
  useEffect(() => {
    if (!live) return;
    const q = query.trim();
    if (q.length < 3) {
      setResult(null);
      return;
    }
    const t = setTimeout(() => run(q), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, live]);

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(query);
        }}
        className="flex gap-2"
      >
        <input
          className="input flex-1"
          placeholder={mode === 'dealer' ? 'Customer name, or exact phone # for another office' : 'Start typing a name, phone, or reference #'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          autoFocus={live}
        />
        {!live && (
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? 'Searching…' : 'Search'}
          </button>
        )}
      </form>

      {live && pending && <p className="text-xs text-gray-400">Searching…</p>}
      {result && <Results result={result} />}
    </div>
  );
}

function Results({ result }: { result: CustomerSearchResult }) {
  if (result.status === 'disabled')
    return <Note>Customer search is turned off. An administrator can enable it.</Note>;
  if (result.status === 'not_granted')
    return <Note>You don&apos;t have access to the full customer search. Ask a Super Admin to grant it (Admin → Users).</Note>;
  if (result.status === 'too_short') return <Note>Type at least 3 characters.</Note>;
  if (result.status === 'rate_limited')
    return <Note>Too many searches — please wait {result.retryAfterSec}s and try again.</Note>;

  if (result.status === 'internal') {
    if (result.matches.length === 0) return <Note>No customers found.</Note>;
    return (
      <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
        {result.matches.map((m) => (
          <Link key={m.applicationId} href={`/staff/find-customer/${m.applicationId}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-gray-50">
            <span className="min-w-0">
              <span className="block truncate font-medium text-gray-900">{m.name}</span>
              <span className="block text-xs text-gray-500">
                {m.dealerName} · {m.province}{m.reference ? ` · #${m.reference}` : ''}
              </span>
            </span>
            <span className="badge shrink-0 bg-gray-100 text-gray-600">{m.statusLabel}</span>
          </Link>
        ))}
      </div>
    );
  }

  // Dealer mode.
  const nothing = result.own.length === 0 && result.other.length === 0;
  if (nothing) return <Note>No customers found.</Note>;
  return (
    <div className="space-y-4">
      {result.own.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Your customers</h3>
          <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
            {result.own.map((m) => (
              <Link key={m.applicationId} href={`/dealer/applications/${m.applicationId}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-gray-50">
                <span className="truncate font-medium text-gray-900">{m.name}</span>
                <span className="badge shrink-0 bg-gray-100 text-gray-600">{m.statusLabel}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {result.other.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Registered with another office</h3>
          <div className="space-y-2">
            {result.other.map((m, i) => (
              <div key={i} className="rounded-xl border border-sky-200 bg-sky-50 p-4">
                <div className="font-semibold text-sky-900">{m.name}</div>
                <p className="mt-1 text-sm text-sky-800">
                  This customer is registered with <strong>{m.officeName}</strong>
                  {m.officeLocation ? ` (${m.officeLocation})` : ''}. Please contact that office for more information.
                </p>
                <div className="mt-2 text-sm text-sky-900">
                  {m.officeContact && <span className="mr-3">Contact: <strong>{m.officeContact}</strong></span>}
                  {m.officePhone ? (
                    <span>📞 <a href={`tel:${m.officePhone.replace(/[^0-9+]/g, '')}`} className="font-semibold underline">{m.officePhone}</a></span>
                  ) : (
                    <span className="text-sky-700">Contact GWA for this office&apos;s phone number.</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">{children}</div>;
}
