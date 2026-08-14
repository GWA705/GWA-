'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { customerSearchAction } from '@/app/(dealer)/dealer/find-customer/actions';
import type { CustomerSearchResult, JournalMatch } from '@/lib/customerSearch';

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
          placeholder={mode === 'dealer' ? 'Customer name or phone number' : 'Start typing a name, phone, or reference #'}
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
    const nothing = result.matches.length === 0 && result.journalMatches.length === 0;
    if (nothing) return <Note>No customers found.</Note>;
    return (
      <div className="space-y-4">
        {result.matches.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Portal deals</h3>
            <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
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
          </div>
        )}

        {result.journalMatches.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">From the sales journals</h3>
            <div className="space-y-3">
              {result.journalMatches.map((m, i) => (
                <JournalCard key={i} m={m} />
              ))}
            </div>
          </div>
        )}
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
          <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
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
              <div key={i} className="rounded-2xl border border-sky-200 bg-sky-50 p-4 shadow-sm">
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

const RESULT_STYLE: Record<string, string> = {
  OK: 'bg-emerald-100 text-emerald-800',
  'PE/OK': 'bg-amber-100 text-amber-800',
  RB: 'bg-gray-200 text-gray-700',
};

// A detailed, GWA-team-facing card for one sales-journal deal.
function JournalCard({ m }: { m: JournalMatch }) {
  const tel = m.phone.replace(/[^0-9+]/g, '');
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      {/* Header: name + result on the left, amount on the right */}
      <div className="flex items-start justify-between gap-4 border-b border-gray-100 bg-gray-50/60 px-5 py-3.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="truncate text-lg font-semibold text-gray-900">{m.name}</h4>
            {m.result && (
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${RESULT_STYLE[m.result] ?? 'bg-gray-100 text-gray-600'}`}>
                {m.result}
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-gray-500">
            {m.source || 'Sales journal'} · {m.year} journal
          </div>
        </div>
        {m.amount && (
          <div className="shrink-0 text-right">
            <div className="text-lg font-semibold tabular-nums text-gray-900">{m.amount}</div>
            <div className="text-[11px] uppercase tracking-wide text-gray-400">Sale</div>
          </div>
        )}
      </div>

      {/* Contact line */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 pt-3 text-sm">
        {m.phone && (
          <a href={`tel:${tel}`} className="font-medium text-sky-700 hover:underline">
            📞 {m.phone}
          </a>
        )}
        {m.address && <span className="text-gray-600">{m.address}</span>}
      </div>

      {/* Detail grid */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-5 py-4 sm:grid-cols-3">
        <Field label="Product(s)" value={m.product} wide />
        <Field label="HD Ref #" value={m.hdRef ? `${m.hdRef}${m.hdOrigin ? ` · ${m.hdOrigin}` : ''}` : ''} />
        <Field label="HD store" value={m.store} />
        <Field label="Date of sale" value={m.saleDate} />
        <Field label="Date paid" value={m.datePaid} />
        <Field label="Paid by" value={m.finance} />
      </dl>

      {m.link && (
        <div className="border-t border-gray-100 px-5 py-2.5 text-right">
          <a href={m.link} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-sky-700 hover:underline">
            Open in journal ↗
          </a>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-2 sm:col-span-3' : ''}>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-900">{value || <span className="text-gray-300">—</span>}</dd>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">{children}</div>;
}
