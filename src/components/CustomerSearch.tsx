'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { customerSearchAction, updateCustomerInfoAction } from '@/app/(dealer)/dealer/find-customer/actions';
import { StatusBadge } from '@/components/StatusBadge';
import { useT, useI18n } from '@/i18n/client';
import type { CustomerSearchResult, JournalMatch } from '@/lib/customerSearch';

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';
}

// Format a yyyy-mm-dd sale date as a friendly, locale-aware date. Parses the parts
// manually so the date never shifts a day across time zones.
function fmtSold(iso: string, locale: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString(locale === 'fr' ? 'fr-CA' : 'en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function CustomerSearch({
  mode,
  placeholder,
  large,
  onSearch,
  pushQuery,
}: {
  mode: 'internal' | 'dealer';
  placeholder?: string;
  large?: boolean;
  // Called when a real search fires (3+ chars) — used to record recent lookups.
  onSearch?: (q: string) => void;
  // Push a query in from outside (e.g. tapping a recent chip); bump `nonce` to
  // re-trigger the same text.
  pushQuery?: { q: string; nonce: number };
}) {
  const t = useT();
  const { locale } = useI18n();
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
    onSearch?.(q.trim());
    const mine = ++seq.current;
    start(async () => {
      const r = await customerSearchAction(q);
      // Ignore out-of-order responses from earlier keystrokes.
      if (mine === seq.current) setResult(r);
    });
  }

  // A recent-lookup chip (or any external trigger) pushed a query in.
  useEffect(() => {
    if (!pushQuery) return;
    setQuery(pushQuery.q);
    run(pushQuery.q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pushQuery?.nonce]);

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
          className={`input flex-1 ${large ? 'h-12 text-base' : ''}`}
          placeholder={placeholder ?? (mode === 'dealer' ? t('findCustomer.placeholderDealer') : t('findCustomer.placeholderInternal'))}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          autoFocus={live}
        />
        {!live && (
          <button type="submit" className={`btn-primary ${large ? 'h-12 px-6' : ''}`} disabled={pending}>
            {pending ? t('findCustomer.searching') : t('findCustomer.search')}
          </button>
        )}
      </form>

      {live && pending && <p className="text-xs text-gray-400">{t('findCustomer.searching')}</p>}
      {result && <Results result={result} />}
    </div>
  );
}

function Results({ result }: { result: CustomerSearchResult }) {
  const t = useT();
  if (result.status === 'disabled')
    return <Note>{t('findCustomer.disabled')}</Note>;
  if (result.status === 'not_granted')
    return <Note>{t('findCustomer.notGranted')}</Note>;
  if (result.status === 'too_short') return <Note>{t('findCustomer.tooShort')}</Note>;
  if (result.status === 'rate_limited')
    return <Note>{t('findCustomer.rateLimited', { n: result.retryAfterSec })}</Note>;

  if (result.status === 'internal') {
    const nothing = result.matches.length === 0 && result.journalMatches.length === 0;
    if (nothing) return <Note>{t('findCustomer.noCustomers')}</Note>;
    return (
      <div className="space-y-4">
        {result.matches.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{t('findCustomer.portalDeals')}</h3>
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
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{t('findCustomer.fromSalesJournals')}</h3>
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
  const nothing = result.own.length === 0 && result.other.length === 0 && result.journal.length === 0;
  if (nothing) return <Note>{t('findCustomer.noCustomers')}</Note>;
  return (
    <div className="space-y-4">
      {result.own.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{t('findCustomer.yourCustomers')}</h3>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {result.own.map((m) => (
              <Link
                key={m.applicationId}
                href={`/dealer/applications/${m.applicationId}`}
                className="group flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm transition hover:border-sky-300 hover:shadow-md"
              >
                <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-sky-700">{initials(m.name)}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-gray-900">{m.name}</span>
                    <StatusBadge status={m.status} short />
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-gray-400">
                    {[m.program, m.province, m.amountLabel, m.submitted].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <ArrowRight size={16} className="flex-none text-gray-300 transition group-hover:text-sky-500" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {result.other.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{t('findCustomer.registeredOtherOffice')}</h3>
          <div className="space-y-2">
            {result.other.map((m, i) => (
              <div key={i} className="rounded-2xl border border-sky-200 bg-sky-50 p-4 shadow-sm">
                <div className="font-semibold text-sky-900">{m.name}</div>
                <p className="mt-1 text-sm text-sky-800">
                  {t('findCustomer.registeredWithPre')} <strong>{m.officeName}</strong>
                  {m.officeLocation ? ` (${m.officeLocation})` : ''}. {t('findCustomer.pleaseContactOffice')}
                </p>
                <div className="mt-2 text-sm text-sky-900">
                  <span className="mr-3">{t('findCustomer.contactLabel')} <strong>{t('findCustomer.gwaOffice')}</strong></span>
                  {m.officePhone ? (
                    <span>📞 <a href={`tel:${m.officePhone.replace(/[^0-9+]/g, '')}`} className="font-semibold underline">{m.officePhone}</a></span>
                  ) : (
                    <span className="text-sky-700">{t('findCustomer.contactForPhone')}</span>
                  )}
                </div>
                {m.officeAddress && (
                  <div className="mt-1 flex items-start gap-1 text-sm text-sky-900">
                    <span aria-hidden>📍</span>
                    <span>{m.officeAddress}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {result.journal.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{t('findCustomer.fromYourPastJournals')}</h3>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {result.journal.map((m) => (
              <div key={m.id} className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-500">{initials(m.customerName)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-gray-900">{m.customerName}</span>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">{m.year}</span>
                    </div>
                    <div className="truncate text-xs text-gray-400">
                      {[m.product, m.hdStore, m.finance, m.amount].filter(Boolean).join(' · ')}
                    </div>
                    {m.saleDate && (
                      <div className="mt-0.5 text-xs font-medium text-gray-600">
                        🗓 {t('findCustomer.sold')} {fmtSold(m.saleDate, locale)}
                      </div>
                    )}
                  </div>
                </div>
                {(m.phone || m.address) && (
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 border-t border-gray-100 pt-2 text-xs">
                    {m.phone && <a href={`tel:${m.phone.replace(/[^0-9+]/g, '')}`} className="font-medium text-sky-700 hover:underline">📞 {m.phone}</a>}
                    {m.address && <span className="text-gray-500">{m.address}</span>}
                  </div>
                )}
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
  const t = useT();
  // Contact fields are editable in place; keep a live copy so the card reflects
  // a save without re-running the search.
  const [phone, setPhone] = useState(m.phone);
  const [address, setAddress] = useState(m.address);
  const [email, setEmail] = useState(m.email);
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [updatedAt, setUpdatedAt] = useState(m.updatedInfoAt);
  const [updatedBy, setUpdatedBy] = useState(m.updatedInfoBy);
  const tel = phone.replace(/[^0-9+]/g, '');

  function save(next: { phone: string; address: string; email: string }) {
    setMsg(null);
    start(async () => {
      const r = await updateCustomerInfoAction({
        applicationId: m.applicationId,
        year: m.year,
        tab: m.tab,
        row: m.row,
        customerName: m.name,
        phone: next.phone,
        address: next.address,
        email: next.email,
      });
      setMsg({ ok: r.ok, text: r.message });
      if (r.ok) {
        setPhone(next.phone);
        setAddress(next.address);
        setEmail(next.email);
        if (r.updatedAt) setUpdatedAt(r.updatedAt);
        if (r.updatedByName) setUpdatedBy(r.updatedByName);
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
            {m.source || t('findCustomer.salesJournal')} · {t('findCustomer.journalYear', { year: m.year })}
          </div>
        </div>
        {m.amount && (
          <div className="shrink-0 text-right">
            <div className="text-lg font-semibold tabular-nums text-gray-900">{m.amount}</div>
            <div className="text-[11px] uppercase tracking-wide text-gray-400">{t('findCustomer.sale')}</div>
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
          {editing ? t('findCustomer.cancel') : t('findCustomer.editInfo')}
        </button>
      </div>
      {updatedAt && (
        <div className="px-5 pt-1 text-[11px] text-gray-400">
          {updatedBy
            ? t('findCustomer.contactUpdatedBy', { when: fmtWhen(updatedAt), by: updatedBy })
            : t('findCustomer.contactUpdated', { when: fmtWhen(updatedAt) })}
        </div>
      )}

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
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{t('findCustomer.dealer')}</span>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <span className="font-semibold text-gray-800">{m.dealerName}</span>
            {m.dealerPhone ? (
              <a href={`tel:${m.dealerPhone.replace(/[^0-9+]/g, '')}`} className="font-medium text-sky-700 hover:underline">
                📞 {m.dealerPhone}
              </a>
            ) : (
              <span className="text-xs text-gray-400">{t('findCustomer.noDealerPhone')}</span>
            )}
          </div>
          {m.dealerAddress && (
            <div className="mt-0.5 flex items-start gap-1 text-xs text-gray-600">
              <span aria-hidden>📍</span>
              <span>{m.dealerAddress}</span>
            </div>
          )}
        </div>
      )}

      {/* Detail grid */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-5 py-4 sm:grid-cols-3">
        <div className="col-span-2 sm:col-span-3">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{t('findCustomer.products')}</dt>
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
        <Field label={t('findCustomer.hdRef')} value={m.hdRef ? `${m.hdRef}${m.hdOrigin ? ` · ${m.hdOrigin}` : ''}` : ''} />
        <Field label={t('findCustomer.hdStore')} value={m.store} />
        <Field label={t('findCustomer.dateOfSale')} value={m.saleDate} />
        <Field label={t('findCustomer.datePaid')} value={m.datePaid} />
        <Field label={t('findCustomer.paidBy')} value={m.finance} />
      </dl>

      {m.link && (
        <div className="border-t border-gray-100 px-5 py-2.5 text-right">
          <a href={m.link} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-sky-700 hover:underline">
            {t('findCustomer.openInJournal')}
          </a>
        </div>
      )}
    </div>
  );
}

// A short, friendly "when" for the last-updated stamp.
function fmtWhen(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
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
  const t = useT();
  const [phone, setPhone] = useState(initial.phone);
  const [address, setAddress] = useState(initial.address);
  const [email, setEmail] = useState(initial.email);
  return (
    <div className="mx-5 mt-3 space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{t('findCustomer.phone')}</span>
          <input className="input mt-0.5" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(416) 555-0123" />
        </label>
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            {t('findCustomer.email')} {!hasPortalRecord && <span className="font-normal normal-case text-gray-400">{t('findCustomer.portalDealsOnly')}</span>}
          </span>
          <input
            className="input mt-0.5"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!hasPortalRecord}
            placeholder={hasPortalRecord ? t('findCustomer.emailPlaceholder') : t('findCustomer.noPortalRecord')}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{t('findCustomer.address')}</span>
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
          {pending ? t('findCustomer.saving') : t('findCustomer.saveChanges')}
        </button>
        <span className="text-[11px] text-gray-400">{hasPortalRecord ? t('findCustomer.savesInfoPortal') : t('findCustomer.savesInfo')}</span>
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
