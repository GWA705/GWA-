import Link from 'next/link';
import type { Lead } from '@/lib/leads';
import { leadKeyOf } from '@/lib/leads';
import { leadCallStatus, type LeadCallRow } from '@/lib/leadCalls';
import { LeadCallTracker } from './LeadCallTracker';
import { LeadsMonthDropdown } from './LeadsMonthDropdown';

const CALL_CHIP: Record<string, string> = {
  grey: 'bg-gray-100 text-gray-600',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-700',
  teal: 'bg-teal-100 text-teal-800',
  green: 'bg-emerald-100 text-emerald-800',
};

// Read-only, searchable list of HD leads with running totals. Shared by the
// dealer (own office) and internal (all offices) pages. No download — view only.

function fmtDate(d: Date | null, fallback: string): string {
  if (!d) return fallback;
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <span className="text-[10px] uppercase tracking-wide text-gray-400">{label}</span>
      <div className="text-sm text-gray-700">{value}</div>
    </div>
  );
}

const PAGE_SIZE = 40;

export function LeadsView({
  leads,
  summary,
  q,
  status,
  basePath,
  extraHidden,
  page = 1,
  month = '',
  monthOptions = [],
  storeNames = {},
  callsByKey = {},
}: {
  leads: Lead[];
  summary: { total: number; noGood: number; forwarded: number };
  q: string;
  status: string;
  basePath: string;
  extraHidden?: { name: string; value: string }[];
  page?: number;
  month?: string;
  monthOptions?: { value: string; label: string }[];
  // HD store number → store name/location, so leads show "Store 7234 — Barrie".
  storeNames?: Record<string, string>;
  // Lead key → logged calls, for the call-tracker on each lead.
  callsByKey?: Record<string, LeadCallRow[]>;
}) {
  const storeLabel = (num: string) => {
    if (!num) return '';
    const name = storeNames[num];
    return name ? `Store ${num} — ${name}` : `Store ${num}`;
  };
  const buildHref = (over: Record<string, string>) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (status) params.set('status', status);
    if (month) params.set('month', month);
    for (const h of extraHidden ?? []) if (h.value) params.set(h.name, h.value);
    for (const [k, v] of Object.entries(over)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    return `${basePath}${params.toString() ? `?${params}` : ''}`;
  };

  const statusLink = (val: string, label: string) => {
    const active = status === val;
    // Changing the filter resets to page 1.
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (val) params.set('status', val);
    if (month) params.set('month', month);
    for (const h of extraHidden ?? []) if (h.value) params.set(h.name, h.value);
    return (
      <Link
        href={`${basePath}${params.toString() ? `?${params}` : ''}`}
        className={`rounded-full px-3 py-1 text-sm font-medium transition ${active ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
      >
        {label}
      </Link>
    );
  };

  const totalPages = Math.max(1, Math.ceil(leads.length / PAGE_SIZE));
  const current = Math.min(Math.max(1, page), totalPages);
  const startIdx = (current - 1) * PAGE_SIZE;
  const pageLeads = leads.slice(startIdx, startIdx + PAGE_SIZE);

  return (
    <div className="space-y-5">
      {/* Totals */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xl font-bold text-gray-900 tabular-nums">{summary.total}</div>
          <div className="text-[10px] uppercase text-gray-500">Leads received</div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xl font-bold text-emerald-600 tabular-nums">{summary.forwarded}</div>
          <div className="text-[10px] uppercase text-gray-500">Forwarded / active</div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xl font-bold text-red-600 tabular-nums">{summary.noGood}</div>
          <div className="text-[10px] uppercase text-gray-500">Marked no-good</div>
        </div>
      </div>

      {/* Search + filter */}
      <form method="GET" className="flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Search name, phone, email, address, booking, store…" className="input min-w-[220px] flex-1" />
        {extraHidden?.map((h) => (h.value ? <input key={h.name} type="hidden" name={h.name} value={h.value} /> : null))}
        {status && <input type="hidden" name="status" value={status} />}
        {month && <input type="hidden" name="month" value={month} />}
        <button type="submit" className="btn-primary">Search</button>
      </form>
      <div className="flex flex-wrap items-center gap-2">
        {statusLink('', 'All')}
        {statusLink('forwarded', 'Forwarded')}
        {statusLink('nogood', 'No-good')}
        {monthOptions.length > 0 && (
          <div className="ml-auto">
            <LeadsMonthDropdown
              value={month}
              options={monthOptions}
              basePath={basePath}
              params={[{ name: 'q', value: q }, { name: 'status', value: status }, ...(extraHidden ?? [])]}
            />
          </div>
        )}
      </div>

      {/* List — compact rows that expand on click */}
      {leads.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-sm text-gray-500">
          {q || status ? 'No leads match your search.' : 'No leads yet.'}
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            {pageLeads.map((l) => {
              const leadKey = leadKeyOf(l);
              const calls = callsByKey[leadKey] ?? [];
              const cs = leadCallStatus(calls);
              return (
              <details key={l.rowId} className="group border-b border-gray-100 last:border-b-0">
                <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-2.5 hover:bg-gray-50">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${l.noGood ? 'bg-red-500' : 'bg-emerald-500'}`} />
                  <span className="min-w-0 flex-1">
                    <span className="truncate font-medium text-gray-900">{l.customerName || '(no name)'}</span>
                    <span className="ml-2 hidden text-xs text-gray-500 sm:inline">
                      {fmtDate(l.dateReceived, l.dateText)}
                      {l.storeNumber && <span className="font-semibold text-gray-700"> · {storeLabel(l.storeNumber)}</span>}
                      {l.service && ` · ${l.service}`}
                    </span>
                  </span>
                  {calls.length > 0 && (
                    <span className={`badge shrink-0 ${CALL_CHIP[cs.tone]}`} title={cs.next ? `Next: ${cs.next}` : undefined}>
                      {cs.label}
                    </span>
                  )}
                  <span className="hidden shrink-0 text-xs text-gray-500 md:inline">{l.phone}</span>
                  <span className={`badge shrink-0 ${l.noGood ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'}`}>
                    {l.noGood ? 'No good' : 'Forwarded'}
                  </span>
                  <span className="shrink-0 text-gray-300 transition group-open:rotate-180">▾</span>
                </summary>
                <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-3">
                  <div className="mb-3 text-sm font-medium text-gray-600">
                    {fmtDate(l.dateReceived, l.dateText)}
                    {l.storeNumber && <span className="font-bold text-gray-800"> · {storeLabel(l.storeNumber)}</span>}
                    {l.service && ` · ${l.service}`}
                    {l.bookingId && ` · #${l.bookingId}`}
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <Field label="Phone" value={l.phone} />
                    <Field label="Email" value={l.email} />
                    <Field label="Contact pref" value={l.contactPreference} />
                    <div className="col-span-2 sm:col-span-3"><Field label="Address" value={l.address} /></div>
                    <Field label="Emergency" value={l.emergency} />
                    <Field label="Financing" value={l.financing} />
                    <Field label="Forwarded to" value={l.forwardedTo} />
                    <div className="col-span-2 sm:col-span-3"><Field label="Service details" value={l.serviceDetails} /></div>
                    <div className="col-span-2 sm:col-span-3"><Field label="Additional info" value={l.additionalInfo} /></div>
                  </div>
                  {l.noGood && (l.noGoodReason || l.reportedToHd) && (
                    <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
                      {l.noGoodReason && <div><span className="font-semibold">No-good reason:</span> {l.noGoodReason}</div>}
                      {l.reportedToHd && <div className="mt-0.5"><span className="font-semibold">Reported to HD:</span> {l.reportedToHd}{l.dateReported ? ` (${l.dateReported})` : ''}</div>}
                    </div>
                  )}
                  <LeadCallTracker leadKey={leadKey} initial={calls} />
                </div>
              </details>
              );
            })}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>
              Showing {startIdx + 1}–{Math.min(startIdx + PAGE_SIZE, leads.length)} of {leads.length}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                {current > 1 ? (
                  <Link href={buildHref({ page: String(current - 1) })} className="btn-secondary text-xs">← Prev</Link>
                ) : (
                  <span className="btn-secondary pointer-events-none text-xs opacity-40">← Prev</span>
                )}
                <span className="text-xs">Page {current} / {totalPages}</span>
                {current < totalPages ? (
                  <Link href={buildHref({ page: String(current + 1) })} className="btn-secondary text-xs">Next →</Link>
                ) : (
                  <span className="btn-secondary pointer-events-none text-xs opacity-40">Next →</span>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function monthKey(d: Date | null): string {
  return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : '';
}

/** Apply the q + status + month filters to a lead list (server-side). */
export function filterLeads(leads: Lead[], q: string, status: string, month = ''): Lead[] {
  let out = leads;
  if (status === 'nogood') out = out.filter((l) => l.noGood);
  else if (status === 'forwarded') out = out.filter((l) => !l.noGood);
  if (month) out = out.filter((l) => monthKey(l.dateReceived) === month);
  const needle = q.trim().toLowerCase();
  if (needle) {
    out = out.filter((l) =>
      [l.customerName, l.phone, l.email, l.address, l.bookingId, l.storeNumber, l.service]
        .join(' ')
        .toLowerCase()
        .includes(needle),
    );
  }
  return out;
}

/** Distinct month options (newest first) present in a lead list. */
export function leadMonthOptions(leads: Lead[]): { value: string; label: string }[] {
  const seen = new Map<string, string>();
  for (const l of leads) {
    if (!l.dateReceived) continue;
    const key = monthKey(l.dateReceived);
    if (!seen.has(key)) seen.set(key, l.dateReceived.toLocaleString('en-US', { month: 'long', year: 'numeric' }));
  }
  return Array.from(seen.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([value, label]) => ({ value, label }));
}
