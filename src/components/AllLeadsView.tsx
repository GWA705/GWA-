import Link from 'next/link';
import { getT } from '@/i18n/server';
import { leadKeyOf, type Lead } from '@/lib/leads';
import type { LeadCallRow } from '@/lib/leadCalls';
import { scannedLeadKey } from '@/lib/scannedLeadKey';
import { StoreLeadRow, storeGroupKey } from './LeadsView';
import { ScannedLeadRowItem, type ScannedLeadRow } from './ScannedLeadsList';
import { scannedGroupKey } from '@/lib/scannedLeadStatus';
import { LeadsSelect } from './LeadsSelect';
import { ScanCardsPanel } from './ScanCardsPanel';

/**
 * The merged "All" leads view: HD Mail In Test cards and Store (Home Depot) leads
 * in ONE status-striped list, with a shared search, sort, status filter and
 * paging. Each row keeps its own type's full detail (the same row components the
 * dedicated tabs use), tagged Mail-In / Store. Server-rendered + URL-param driven,
 * matching the Store tab; the scanner is a small client island.
 */

const PAGE_SIZE = 20;

const GROUPS: { k: string; label: string }[] = [
  { k: 'new', label: 'New' },
  { k: 'working', label: 'Working' },
  { k: 'spoke', label: 'Spoke' },
  { k: 'booked', label: 'Booked' },
  { k: 'sold', label: 'Sold' },
  { k: 'nogood', label: 'No good' },
];
const GROUP_ORDER = ['new', 'working', 'spoke', 'booked', 'sold', 'nogood'];

const SORT_OPTIONS = [
  { value: 'old', label: 'Oldest first' },
  { value: 'name', label: 'Name A–Z' },
  { value: 'store', label: 'Store #' },
  { value: 'status', label: 'Status' },
  { value: 'type', label: 'Lead type' },
];

const MAILIN_TAG = (
  <span className="shrink-0 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-700">Mail-In</span>
);
const STORE_TAG = (
  <span className="shrink-0 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-700">Store</span>
);

interface UnifiedRow {
  type: 'mailin' | 'store';
  id: string;
  key: string;
  when: number;
  group: string;
  hay: string;
  name: string;
  store: string;
  calls: LeadCallRow[];
  mailin?: ScannedLeadRow;
  store_?: Lead;
}

export function AllLeadsView({
  mailin,
  store,
  callsByKey,
  storeNames = {},
  q,
  group,
  sort,
  page,
  basePath,
  extraHidden = [],
  isStaff = false,
  showOffice = false,
  canScan = false,
}: {
  mailin: ScannedLeadRow[];
  store: Lead[];
  callsByKey: Record<string, LeadCallRow[]>;
  storeNames?: Record<string, string>;
  q: string;
  group: string;
  sort: string;
  page: number;
  basePath: string;
  extraHidden?: { name: string; value: string }[];
  isStaff?: boolean;
  showOffice?: boolean;
  canScan?: boolean;
}) {
  const t = getT();

  const rows: UnifiedRow[] = [];
  for (const l of mailin) {
    const key = scannedLeadKey(l.id);
    const calls = callsByKey[key] ?? [];
    rows.push({
      type: 'mailin',
      id: l.id,
      key,
      when: Date.parse(l.createdAt) || 0,
      group: l.status === 'NO_GOOD' ? 'nogood' : scannedGroupKey(l.status, calls),
      hay: [l.customerName, l.phone, l.storeNumber, l.city, l.address, l.postalCode].filter(Boolean).join(' ').toLowerCase(),
      name: l.customerName ?? '',
      store: l.storeNumber ?? '',
      calls,
      mailin: l,
    });
  }
  for (const l of store) {
    const key = leadKeyOf(l);
    const calls = callsByKey[key] ?? [];
    rows.push({
      type: 'store',
      id: l.rowId,
      key,
      when: l.dateReceived ? l.dateReceived.getTime() : 0,
      group: storeGroupKey(l, calls),
      hay: [l.customerName, l.phone, l.storeNumber, l.address, l.bookingId, l.service].filter(Boolean).join(' ').toLowerCase(),
      name: l.customerName ?? '',
      store: l.storeNumber ?? '',
      calls,
      store_: l,
    });
  }

  // q filter (shared across both types)
  const needle = q.trim().toLowerCase();
  const qFiltered = needle ? rows.filter((r) => r.hay.includes(needle)) : rows;

  // status-group counts over the q-filtered set
  const counts: Record<string, number> = { all: qFiltered.length };
  for (const g of GROUPS) counts[g.k] = 0;
  for (const r of qFiltered) counts[r.group] = (counts[r.group] ?? 0) + 1;

  const filtered = group && group !== 'all' ? qFiltered.filter((r) => r.group === group) : qFiltered;

  const byName = (a: UnifiedRow, b: UnifiedRow) => a.name.localeCompare(b.name);
  filtered.sort((a, b) => {
    switch (sort) {
      case 'old': return a.when - b.when;
      case 'name': return byName(a, b);
      case 'store': return a.store.localeCompare(b.store) || byName(a, b);
      case 'status': return GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) || byName(a, b);
      case 'type': return a.type.localeCompare(b.type) || b.when - a.when;
      default: return b.when - a.when; // newest first
    }
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(Math.max(1, page), totalPages);
  const start = (current - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  // href builder preserving q / g / sort / tab (+ extraHidden), overriding the given keys
  const buildHref = (over: Record<string, string>) => {
    const sp = new URLSearchParams();
    if (q) sp.set('q', q);
    if (group) sp.set('g', group);
    if (sort) sp.set('sort', sort);
    for (const h of extraHidden) if (h.value) sp.set(h.name, h.value);
    for (const [k, v] of Object.entries(over)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    return `${basePath}${sp.toString() ? `?${sp}` : ''}`;
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <form method="GET" className="flex flex-1 gap-2">
            <input name="q" defaultValue={q} placeholder="Search name, phone, store, city…" aria-label="Search all leads" className="input flex-1" />
            {group && <input type="hidden" name="g" value={group} />}
            {sort && <input type="hidden" name="sort" value={sort} />}
            {extraHidden.map((h) => (h.value ? <input key={h.name} type="hidden" name={h.name} value={h.value} /> : null))}
            <button type="submit" className="btn-primary">Search</button>
          </form>
          <LeadsSelect
            paramName="sort"
            value={sort}
            options={SORT_OPTIONS}
            allLabel="Newest first"
            ariaLabel="Sort leads"
            basePath={basePath}
            params={[{ name: 'q', value: q }, { name: 'g', value: group }, ...extraHidden]}
          />
        </div>

        {canScan && (
          <div className="mt-2">
            <ScanCardsPanel />
          </div>
        )}

        {/* status filter chips */}
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
          {[{ k: 'all', label: 'All' }, ...GROUPS].map((g) => {
            const n = counts[g.k] ?? 0;
            if (g.k !== 'all' && n === 0) return null;
            const active = (group || 'all') === g.k;
            return (
              <Link
                key={g.k}
                href={buildHref({ g: g.k === 'all' ? '' : g.k, page: '' })}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  active ? 'border-slate-800 bg-slate-800 text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {g.label}
                <span className={`tabular-nums ${active ? 'text-gray-300' : 'text-gray-400'}`}>{n}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-5 text-center text-sm text-gray-500">
          {rows.length === 0 ? 'No leads yet.' : 'No leads match your search or filter.'}
        </p>
      ) : (
        <>
          <div className="space-y-2">
            {pageItems.map((r) =>
              r.type === 'mailin' && r.mailin ? (
                <ScannedLeadRowItem key={`m_${r.id}`} lead={r.mailin} calls={r.calls} showOffice={showOffice} typeTag={MAILIN_TAG} />
              ) : r.store_ ? (
                <StoreLeadRow key={`s_${r.id}`} l={r.store_} calls={r.calls} storeNames={storeNames} isStaff={isStaff} t={t} typeTag={STORE_TAG} />
              ) : null,
            )}
          </div>

          <div className="flex items-center justify-between text-sm text-gray-500">
            <span className="tabular-nums">
              Showing {start + 1}–{Math.min(start + PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                {current > 1 ? (
                  <Link href={buildHref({ page: String(current - 1) })} className="btn-secondary text-xs">Prev</Link>
                ) : (
                  <span className="btn-secondary pointer-events-none text-xs opacity-40">Prev</span>
                )}
                <span className="text-xs tabular-nums">{current} / {totalPages}</span>
                {current < totalPages ? (
                  <Link href={buildHref({ page: String(current + 1) })} className="btn-secondary text-xs">Next</Link>
                ) : (
                  <span className="btn-secondary pointer-events-none text-xs opacity-40">Next</span>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
