'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { customerSearchAction, updateCustomerInfoAction } from '@/app/(dealer)/dealer/find-customer/actions';
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
  // Contact fields are editable in place; keep a live copy so the card reflects
  // a save without re-running the search.
  const [phone, setPhone] = useState(m.phone);
  const [address, setAddress] = useState(m.address);
  const [email, setEmail] = useState(m.email);
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const tel = phone.replace(/[^0-9+]/g, '');

  function save(next: { phone: string; address: string; email: string }) {
    setMsg(null);
    start(async () => {
      const r = await updateCustomerInfoAction({
        year: m.year,
        tab: m.tab,
        row: m.row,
        lastName: m.lastName,
        applicationId: m.applicationId,
        phone: next.phone,
        address: next.address,
        email: next.email,
      });
      setMsg({ ok: r.ok, text: r.message });
      if (r.ok) {
        setPhone(next.phone);
        setAddress(next.address);
        setEmail(next.email);
        setEditing(false);
      }
    });
  }

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
            {m.dealerName && <span className="font-semibold text-gray-700">{m.dealerName} · </span>}
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

      {/* Customer contact line + edit toggle */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 pt-3 text-sm">
        {phone && (
          <a href={`tel:${tel}`} className="font-medium text-sky-700 hover:underline">
            📞 {phone}
          </a>
        )}
        {address && <span className="text-gray-600">{address}</span>}
        {email && <span className="text-gray-500">{email}</span>}
        <button
          type="button"
          onClick={() => { setEditing((v) => !v); setMsg(null); }}
          className="ml-auto text-xs font-semibold text-gray-500 hover:text-gray-700 hover:underline"
        >
          {editing ? 'Cancel' : '✎ Edit info'}
        </button>
      </div>

      {editing && (
        <CustomerEditForm
          initial={{ phone, address, email }}
          hasPortalRecord={!!m.applicationId}
          pending={pending}
          onSave={save}
        />
      )}
      {msg && (
        <div className={`mx-5 mt-2 rounded-md px-3 py-2 text-xs ${msg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {msg.text}
        </div>
      )}

      {/* Dealer / office to contact */}
      {m.dealerName && (
        <div className="mx-5 mt-3 rounded-lg bg-brand-50/60 px-3 py-2 text-sm">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Dealer</span>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <span className="font-semibold text-gray-800">{m.dealerName}</span>
            {m.dealerPhone ? (
              <a href={`tel:${m.dealerPhone.replace(/[^0-9+]/g, '')}`} className="font-medium text-sky-700 hover:underline">
                📞 {m.dealerPhone}
              </a>
            ) : (
              <span className="text-xs text-gray-400">No contact number yet — the office adds it in their dealer profile.</span>
            )}
          </div>
        </div>
      )}

      {/* Detail grid */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-5 py-4 sm:grid-cols-3">
        <div className="col-span-2 sm:col-span-3">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Product(s)</dt>
          <dd className="mt-0.5 text-sm text-gray-900">
            {m.productItems.length === 0 ? (
              <span className="text-gray-300">—</span>
            ) : (
              <span className="flex flex-wrap items-center gap-1.5">
                {m.productItems.map((p, idx) =>
                  p.resourceId ? (
                    <Link
                      key={idx}
                      href={`/staff/resources/library/${p.resourceId}`}
                      className="rounded bg-sky-50 px-1.5 py-0.5 font-medium text-sky-700 underline decoration-sky-300 underline-offset-2 hover:bg-sky-100"
                    >
                      {p.code}
                    </Link>
                  ) : (
                    <span key={idx} className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-700">{p.code}</span>
                  ),
                )}
              </span>
            )}
          </dd>
        </div>
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

// Inline editor for a customer's contact details (phone / address / email).
function CustomerEditForm({
  initial,
  hasPortalRecord,
  pending,
  onSave,
}: {
  initial: { phone: string; address: string; email: string };
  hasPortalRecord: boolean;
  pending: boolean;
  onSave: (v: { phone: string; address: string; email: string }) => void;
}) {
  const [phone, setPhone] = useState(initial.phone);
  const [address, setAddress] = useState(initial.address);
  const [email, setEmail] = useState(initial.email);
  return (
    <div className="mx-5 mt-3 space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Phone</span>
          <input className="input mt-0.5" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(416) 555-0123" />
        </label>
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Email {!hasPortalRecord && <span className="font-normal normal-case text-gray-400">(portal deals only)</span>}
          </span>
          <input
            className="input mt-0.5"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!hasPortalRecord}
            placeholder={hasPortalRecord ? 'name@email.com' : 'No portal record for this deal'}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Address</span>
          <input className="input mt-0.5" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="12 Main St, Barrie ON" />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onSave({ phone, address, email })}
          disabled={pending}
          className="btn-primary text-sm"
        >
          {pending ? 'Saving…' : 'Save changes'}
        </button>
        <span className="text-[11px] text-gray-400">Phone &amp; address update the journal{hasPortalRecord ? ' and the portal deal' : ''}. Changes are logged.</span>
      </div>
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
