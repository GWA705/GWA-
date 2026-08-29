import Link from 'next/link';
import type { Lead } from '@/lib/leads';
import { leadKeyOf } from '@/lib/leads';
import { leadCallStatus, type LeadCallRow } from '@/lib/leadCalls';
import { LeadCallTracker } from './LeadCallTracker';
import { LeadNoGoodControl } from './LeadNoGoodControl';
import { LeadsMonthDropdown } from './LeadsMonthDropdown';
import { LeadsSelect } from './LeadsSelect';
import { LeadsMap, type MapLead, type MapStore, type LatLng } from './LeadsMap';
import { ProjectPhotosButton } from './ProjectPhotosButton';

// Turn any URLs inside a text field into clickable links (shortened for display).
function linkify(text: string): React.ReactNode {
  const parts = text.split(/(https?:\/\/[^\s<>"]+)/g);
  return parts.map((p, i) => {
    if (/^https?:\/\//.test(p)) {
      const label = p.replace(/^https?:\/\//, '');
      return (
        <a key={i} href={p} target="_blank" rel="noopener noreferrer" className="break-all text-brand-700 underline">
          {label.length > 48 ? `${label.slice(0, 48)}…` : label}
        </a>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

// Pull the Home Depot "project photos" URL out of a lead's text, if present.
function projectPhotosUrl(...texts: string[]): string | null {
  for (const t of texts) {
    const m = (t || '').match(/https?:\/\/[^\s<>"]*home-services-installer-lead[^\s<>"]*/i);
    if (m) return m[0];
  }
  return null;
}

const CALL_CHIP: Record<string, string> = {
  grey: 'bg-gray-100 text-gray-600',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-700',
  teal: 'bg-teal-100 text-teal-800',
  green: 'bg-emerald-100 text-emerald-800',
  violet: 'bg-violet-100 text-violet-800',
};

// HD sends names in ALL CAPS — show them Title Cased so the list reads cleanly.
function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\p{L}/gu, (m) => m.toUpperCase());
}

type LeadStateKey = 'new' | 'working' | 'booked' | 'nogood';
const GROUPS: { key: LeadStateKey; label: string; chip: string; stripe: string }[] = [
  { key: 'new', label: 'Needs a call', chip: 'bg-brand-50 text-brand-700', stripe: 'border-brand-500' },
  { key: 'working', label: 'Working', chip: 'bg-amber-100 text-amber-800', stripe: 'border-amber-500' },
  { key: 'booked', label: 'Booked & sold', chip: 'bg-emerald-100 text-emerald-800', stripe: 'border-emerald-500' },
  { key: 'nogood', label: 'No-good', chip: 'bg-red-100 text-red-700', stripe: 'border-red-500' },
];

/** Which pile a lead is in — drives the left stripe and the grouped view. */
function leadStateKey(noGood: boolean, hasCalls: boolean, tone: string): LeadStateKey {
  if (noGood) return 'nogood';
  if (tone === 'green' || tone === 'violet') return 'booked'; // Booked or Sold
  if (hasCalls) return 'working';
  return 'new';
}
const STRIPE: Record<LeadStateKey, string> = {
  new: 'border-brand-500',
  working: 'border-amber-500',
  booked: 'border-emerald-500',
  nogood: 'border-red-500',
};
const GROUP_ORDER: Record<LeadStateKey, number> = { new: 0, working: 1, booked: 2, nogood: 3 };
const GROUP_META: Record<LeadStateKey, { label: string; chip: string; stripe: string }> = Object.fromEntries(
  GROUPS.map((g) => [g.key, { label: g.label, chip: g.chip, stripe: g.stripe }]),
) as Record<LeadStateKey, { label: string; chip: string; stripe: string }>;

// Options for the "Outcome" filter dropdown (last call result, or lead state).
export const LEAD_OUTCOME_FILTERS: { value: string; label: string }[] = [
  { value: 'new', label: 'New (needs a call)' },
  { value: 'NO_ANSWER', label: 'No answer' },
  { value: 'LEFT_MESSAGE', label: 'Message left' },
  { value: 'SPOKE', label: 'Spoke' },
  { value: 'BOOKED', label: 'Booked' },
  { value: 'SOLD', label: 'Sold' },
  { value: 'NOT_INTERESTED', label: 'No interest' },
  { value: 'nogood', label: 'No-good' },
];

/** A single filterable outcome key for a lead: no-good, uncalled ('new'), or its last call outcome. */
export function leadOutcomeKey(noGood: boolean, calls: { outcome: string }[]): string {
  if (noGood) return 'nogood';
  if (calls.length === 0) return 'new';
  return calls[calls.length - 1].outcome;
}

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
      <div className="whitespace-pre-wrap break-words text-sm text-gray-700">{linkify(value)}</div>
    </div>
  );
}

const PAGE_SIZE = 40;

/** Great-circle distance in km between two lat/lng points. */
function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** One lead row — a status-striped summary that expands to the full detail. */
function LeadRow({
  l,
  leadKey,
  calls,
  cs,
  stripe,
  storeLabel,
  isStaff,
}: {
  l: Lead;
  leadKey: string;
  calls: LeadCallRow[];
  cs: { tone: string; label: string; next: string | null };
  stripe: string;
  storeLabel: (n: string) => string;
  isStaff: boolean;
}) {
  return (
    <details className="group border-b border-gray-100 last:border-b-0">
      <summary className={`flex cursor-pointer list-none items-center gap-3 border-l-4 ${stripe} px-4 py-2.5 hover:bg-gray-50`}>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-gray-900">{titleCase(l.customerName) || '(no name)'}</span>
          <span className="mt-0.5 block truncate text-xs text-gray-500">
            {l.storeNumber ? storeLabel(l.storeNumber) : l.service || fmtDate(l.dateReceived, l.dateText)}
          </span>
        </span>
        <span className="hidden shrink-0 text-xs text-gray-500 md:inline">{l.phone}</span>
        <span className={`badge shrink-0 ${l.noGood ? 'bg-red-100 text-red-700' : CALL_CHIP[cs.tone]}`} title={cs.next ? `Next: ${cs.next}` : undefined}>
          {l.noGood ? 'No-good' : cs.label}
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
        {(() => {
          const photos = projectPhotosUrl(l.serviceDetails, l.additionalInfo);
          return photos ? <ProjectPhotosButton url={photos} bookingId={l.bookingId} /> : null;
        })()}
        {l.noGood && (l.noGoodReason || l.reportedToHd) && (
          <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
            {l.noGoodReason && <div><span className="font-semibold">No-good reason:</span> {l.noGoodReason}</div>}
            {l.reportedToHd && <div className="mt-0.5"><span className="font-semibold">Reported to HD:</span> {l.reportedToHd}{l.dateReported ? ` (${l.dateReported})` : ''}</div>}
          </div>
        )}
        <LeadNoGoodControl rowId={l.rowId} bookingId={l.bookingId} noGood={l.noGood} canUnmark={isStaff} />
        <LeadCallTracker leadKey={leadKey} initial={calls} />
      </div>
    </details>
  );
}

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
  isStaff = false,
  view = 'list',
  outcome = '',
  geo,
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
  // Staff may reverse a No-Good flag; dealers can only set it.
  isStaff?: boolean;
  // 'list' = flat status-striped list; 'grouped' = grouped by what to do next;
  // 'map' = Leaflet map of leads + stores.
  view?: 'list' | 'grouped' | 'map';
  // Filter to a single outcome (see LEAD_OUTCOME_FILTERS); '' = all.
  outcome?: string;
  // Map data (only needed for the map view): store coords + per-lead geocode.
  geo?: { stores: MapStore[]; byKey: Record<string, { geoKey: string; query: string; coord?: LatLng | null }> };
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
    if (view !== 'list') params.set('view', view);
    if (outcome) params.set('outcome', outcome);
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
    if (view !== 'list') params.set('view', view);
    if (outcome) params.set('outcome', outcome);
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

  // Segmented List / Grouped / Map toggle — preserves the current search + filters.
  const viewLink = (val: 'list' | 'grouped' | 'map', label: string) => {
    const active = view === val;
    return (
      <Link
        href={buildHref({ view: val === 'list' ? '' : val, page: '' })}
        className={`px-3 py-1 text-sm font-medium transition ${active ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
      >
        {label}
      </Link>
    );
  };

  // Annotate every lead with its calls + call status + pile, once.
  const annotated = leads.map((l) => {
    const leadKey = leadKeyOf(l);
    const calls = callsByKey[leadKey] ?? [];
    const cs = leadCallStatus(calls);
    const stateKey = leadStateKey(l.noGood, calls.length > 0, cs.tone);
    return { l, leadKey, calls, cs, stateKey };
  });
  // In grouped view, order leads by pile so pagination walks group-by-group.
  const ordered =
    view === 'grouped'
      ? [...annotated].sort((a, b) => GROUP_ORDER[a.stateKey] - GROUP_ORDER[b.stateKey])
      : annotated;
  // Total per pile across the whole filtered set (headers show the real count).
  const groupTotals: Record<LeadStateKey, number> = { new: 0, working: 0, booked: 0, nogood: 0 };
  for (const x of annotated) groupTotals[x.stateKey]++;

  const totalPages = Math.max(1, Math.ceil(ordered.length / PAGE_SIZE));
  const current = Math.min(Math.max(1, page), totalPages);
  const startIdx = (current - 1) * PAGE_SIZE;
  const pageItems = ordered.slice(startIdx, startIdx + PAGE_SIZE);

  // Map data (only used when view === 'map'): turn the annotated leads into
  // pins, attaching cached coordinates and a distance to their store.
  const mapStores: MapStore[] = geo?.stores ?? [];
  const storeByNum: Record<string, MapStore> = {};
  for (const s of mapStores) storeByNum[s.number] = s;
  const openHrefFor = (l: Lead) => {
    const p = new URLSearchParams();
    for (const h of extraHidden ?? []) if (h.value) p.set(h.name, h.value);
    p.set('view', 'list');
    const digits = (l.bookingId || '').replace(/\D/g, '');
    p.set('q', digits || l.customerName || '');
    return `${basePath}?${p}`;
  };
  const mapLeads: MapLead[] = annotated.map((x) => {
    const g = geo?.byKey[x.leadKey];
    const coord = g?.coord;
    const st = storeByNum[x.l.storeNumber];
    let dist: string | undefined;
    if (coord && st) {
      const km = haversineKm(coord, st);
      dist = km >= 10 ? `${km.toFixed(0)} km away` : `${km.toFixed(1)} km away`;
    }
    return {
      key: g?.geoKey ?? x.leadKey,
      query: g?.query ?? '',
      rowId: x.l.rowId,
      name: titleCase(x.l.customerName),
      status: x.stateKey,
      statusLabel: x.l.noGood ? 'No-good' : x.cs.label,
      sub: x.l.storeNumber ? storeLabel(x.l.storeNumber) : x.l.service || '',
      dist,
      openHref: openHrefFor(x.l),
      coord,
    };
  });

  return (
    <div className="space-y-5">
      {/* Totals */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xl font-bold text-gray-900 tabular-nums">{summary.total}</div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Received</div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xl font-bold text-emerald-600 tabular-nums">{summary.forwarded}</div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Forwarded</div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xl font-bold text-red-600 tabular-nums">{summary.noGood}</div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">No-good</div>
        </div>
      </div>

      {/* Search + filter */}
      <form method="GET" className="flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Search name, phone, email, address, booking, store…" className="input min-w-[220px] flex-1" />
        {extraHidden?.map((h) => (h.value ? <input key={h.name} type="hidden" name={h.name} value={h.value} /> : null))}
        {status && <input type="hidden" name="status" value={status} />}
        {month && <input type="hidden" name="month" value={month} />}
        {outcome && <input type="hidden" name="outcome" value={outcome} />}
        {view !== 'list' && <input type="hidden" name="view" value={view} />}
        <button type="submit" className="btn-primary">Search</button>
      </form>
      <div className="flex flex-wrap items-center gap-2">
        {statusLink('', 'All')}
        {statusLink('forwarded', 'Forwarded')}
        {statusLink('nogood', 'No-good')}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full bg-gray-100 p-0.5" role="group" aria-label="View">
            {viewLink('list', 'List')}
            {viewLink('grouped', 'Grouped')}
            {viewLink('map', 'Map')}
          </div>
          <LeadsSelect
            paramName="outcome"
            value={outcome}
            options={LEAD_OUTCOME_FILTERS}
            allLabel="All outcomes"
            ariaLabel="Filter by outcome"
            basePath={basePath}
            params={[
              { name: 'q', value: q },
              { name: 'status', value: status },
              { name: 'month', value: month },
              { name: 'view', value: view === 'list' ? '' : view },
              ...(extraHidden ?? []),
            ]}
          />
          {monthOptions.length > 0 && (
            <LeadsMonthDropdown
              value={month}
              options={monthOptions}
              basePath={basePath}
              params={[
                { name: 'q', value: q },
                { name: 'status', value: status },
                { name: 'outcome', value: outcome },
                { name: 'view', value: view === 'list' ? '' : view },
                ...(extraHidden ?? []),
              ]}
            />
          )}
        </div>
      </div>

      {/* Leads — a flat status-striped list, or grouped by what to do next.
          Both views paginate so a long list never runs off the bottom. */}
      {leads.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-sm text-gray-500">
          {q || status || month || outcome ? 'No leads match your search.' : 'No leads yet.'}
        </div>
      ) : view === 'map' ? (
        <LeadsMap leads={mapLeads} stores={mapStores} />
      ) : (
        <>
          {view === 'grouped' ? (
            <div className="space-y-4">
              {(() => {
                // Break the current page into contiguous runs by pile, so a page
                // that straddles two piles shows a header for each.
                const blocks: { key: LeadStateKey; items: typeof pageItems }[] = [];
                for (const x of pageItems) {
                  const last = blocks[blocks.length - 1];
                  if (last && last.key === x.stateKey) last.items.push(x);
                  else blocks.push({ key: x.stateKey, items: [x] });
                }
                return blocks.map((b, bi) => {
                  const g = GROUP_META[b.key];
                  return (
                    <div key={`${b.key}-${bi}`}>
                      <div className="mb-2 flex items-center gap-2 px-1">
                        <span className={`badge ${g.chip}`}>{g.label}</span>
                        <span className="text-xs text-gray-400">{groupTotals[b.key]}</span>
                      </div>
                      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                        {b.items.map((x) => (
                          <LeadRow key={x.l.rowId} l={x.l} leadKey={x.leadKey} calls={x.calls} cs={x.cs} stripe={g.stripe} storeLabel={storeLabel} isStaff={isStaff} />
                        ))}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              {pageItems.map((x) => (
                <LeadRow key={x.l.rowId} l={x.l} leadKey={x.leadKey} calls={x.calls} cs={x.cs} stripe={STRIPE[x.stateKey]} storeLabel={storeLabel} isStaff={isStaff} />
              ))}
            </div>
          )}

          {/* Pagination (shared by both views) */}
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>
              Showing {startIdx + 1}–{Math.min(startIdx + PAGE_SIZE, ordered.length)} of {ordered.length}
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
