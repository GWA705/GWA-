'use client';

import { useMemo, useState } from 'react';
import { ScannedLeadRowItem, type ScannedLeadRow } from './ScannedLeadsList';
import { ScanLeadCard } from './ScanLeadCard';
import { LeadsMap, type MapLead, type MapStore, type PendingStore, type LatLng } from './LeadsMap';
import { scannedGroupKey } from '@/lib/scannedLeadStatus';
import type { LeadCallRow } from '@/lib/leadCalls';
import { scannedLeadKey } from '@/lib/scannedLeadKey';

/**
 * The "HD Mail In Test" workspace: a toolbar (search · sort · status filter · the
 * tucked-away scanner) over the mail-in test-card leads, with the same List /
 * Grouped / Map view options the Store (HD) leads have. Paged so a long list
 * never runs off the bottom.
 */

const STATUS_DEFS = [
  { k: 'new', label: 'New' },
  { k: 'working', label: 'Working' },
  { k: 'spoke', label: 'Spoke' },
  { k: 'booked', label: 'Booked' },
  { k: 'sold', label: 'Sold' },
  { k: 'nogood', label: 'No good' },
];
const GROUP_LABEL: Record<string, string> = Object.fromEntries(STATUS_DEFS.map((d) => [d.k, d.label]));

const SORTS: { k: string; label: string }[] = [
  { k: 'new', label: 'Newest scanned' },
  { k: 'old', label: 'Oldest scanned' },
  { k: 'name', label: 'Name A–Z' },
  { k: 'store', label: 'Store #' },
  { k: 'collected', label: 'Collected date' },
  { k: 'status', label: 'Status' },
];
const STATUS_SORT_ORDER = ['new', 'working', 'spoke', 'booked', 'sold', 'nogood'];

const PAGE = 12;

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\p{L}/gu, (m) => m.toUpperCase());
}

// Mail-in groups (6) collapse to the map's 4 pin colours.
function mapStatus(group: string): MapLead['status'] {
  if (group === 'nogood') return 'nogood';
  if (group === 'booked' || group === 'sold') return 'booked';
  if (group === 'new') return 'new';
  return 'working'; // working, spoke
}

export interface MailInGeo {
  stores: MapStore[];
  pendingStores: PendingStore[];
  byKey: Record<string, { geoKey: string; query: string; coord?: LatLng | null }>;
}

export function MailInTestWorkspace({
  leads,
  callsByKey = {},
  showOffice = false,
  canScan = false,
  geo,
  basePath = '/dealer/leads',
}: {
  leads: ScannedLeadRow[];
  callsByKey?: Record<string, LeadCallRow[]>;
  showOffice?: boolean;
  canScan?: boolean;
  geo?: MailInGeo;
  basePath?: string;
}) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('new');
  const [status, setStatus] = useState('all');
  const [shown, setShown] = useState(PAGE);
  const [scanOpen, setScanOpen] = useState(false);
  const [view, setView] = useState<'list' | 'grouped' | 'map'>('list');

  const annotated = useMemo(
    () =>
      leads.map((l) => {
        const calls = callsByKey[scannedLeadKey(l.id)] ?? [];
        return { l, group: scannedGroupKey(l.status, calls) };
      }),
    [leads, callsByKey],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: annotated.length };
    for (const d of STATUS_DEFS) c[d.k] = 0;
    for (const a of annotated) c[a.group] = (c[a.group] ?? 0) + 1;
    return c;
  }, [annotated]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = annotated.filter((a) => {
      if (status !== 'all' && a.group !== status) return false;
      if (needle) {
        const hay = [a.l.customerName, a.l.phone, a.l.storeNumber, a.l.city, a.l.address, a.l.postalCode]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    const byName = (a: typeof rows[number], b: typeof rows[number]) =>
      (a.l.customerName ?? '').localeCompare(b.l.customerName ?? '');
    rows.sort((a, b) => {
      switch (sort) {
        case 'old':
          return a.l.createdAt.localeCompare(b.l.createdAt);
        case 'name':
          return byName(a, b);
        case 'store':
          return (a.l.storeNumber ?? '').localeCompare(b.l.storeNumber ?? '') || byName(a, b);
        case 'collected':
          return (b.l.collectedOn ?? '').localeCompare(a.l.collectedOn ?? '');
        case 'status':
          return STATUS_SORT_ORDER.indexOf(a.group) - STATUS_SORT_ORDER.indexOf(b.group) || byName(a, b);
        default:
          return b.l.createdAt.localeCompare(a.l.createdAt);
      }
    });
    return rows;
  }, [annotated, q, status, sort]);

  // Grouped ordering: group-primary, keeping the chosen sort within each group.
  const ordered = useMemo(() => {
    if (view !== 'grouped') return filtered;
    return [...filtered].sort((a, b) => STATUS_SORT_ORDER.indexOf(a.group) - STATUS_SORT_ORDER.indexOf(b.group));
  }, [filtered, view]);

  const page = ordered.slice(0, shown);

  const groupTotals = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of filtered) c[r.group] = (c[r.group] ?? 0) + 1;
    return c;
  }, [filtered]);

  const mapLeads: MapLead[] = useMemo(() => {
    if (view !== 'map') return [];
    return filtered.map(({ l, group }) => {
      const g = geo?.byKey[scannedLeadKey(l.id)];
      const sub = [l.storeNumber && `Store ${l.storeNumber}`, l.city, l.collectedOn && `collected ${l.collectedOn}`]
        .filter(Boolean)
        .join(' · ');
      return {
        key: g?.geoKey || scannedLeadKey(l.id),
        query: g?.query ?? '',
        rowId: l.id,
        name: l.customerName ? titleCase(l.customerName) : '(no name)',
        status: mapStatus(group),
        statusLabel: GROUP_LABEL[group] ?? 'Lead',
        sub,
        openHref: `${basePath}?tab=mailin`,
        coord: g?.coord,
      };
    });
  }, [filtered, view, geo, basePath]);

  const resetPage = () => setShown(PAGE);
  const viewBtn = (v: typeof view, label: string) => (
    <button
      type="button"
      onClick={() => { setView(v); resetPage(); }}
      className={`px-3 py-1 text-sm font-medium transition ${view === v ? 'bg-white text-brand-700 shadow-sm rounded-full' : 'text-gray-600 hover:text-gray-800'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); resetPage(); }}
            placeholder="Search name, phone, store, city…"
            aria-label="Search HD Mail In Test"
            className="input flex-1"
          />
          <div className="flex gap-2">
            <label className="sr-only" htmlFor="mailin_sort">Sort</label>
            <select id="mailin_sort" value={sort} onChange={(e) => setSort(e.target.value)} className="input w-full sm:w-auto">
              {SORTS.map((s) => (
                <option key={s.k} value={s.k}>{s.label}</option>
              ))}
            </select>
            {canScan && (
              <button type="button" onClick={() => setScanOpen((v) => !v)} aria-expanded={scanOpen} className="btn-primary whitespace-nowrap">
                {scanOpen ? '× Close' : '＋ Scan cards'}
              </button>
            )}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {/* Status filter chips */}
          <div className="flex flex-1 gap-1.5 overflow-x-auto pb-1">
            {[{ k: 'all', label: 'All' }, ...STATUS_DEFS].map((d) => {
              const n = counts[d.k] ?? 0;
              if (d.k !== 'all' && n === 0) return null;
              const active = status === d.k;
              return (
                <button
                  key={d.k}
                  type="button"
                  aria-pressed={active}
                  onClick={() => { setStatus(d.k); resetPage(); }}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    active ? 'border-slate-800 bg-slate-800 text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {d.label}
                  <span className={`tabular-nums ${active ? 'text-gray-300' : 'text-gray-400'}`}>{n}</span>
                </button>
              );
            })}
          </div>
          {/* View toggle */}
          <div className="inline-flex flex-none rounded-full bg-gray-100 p-0.5" role="group" aria-label="View">
            {viewBtn('list', 'List')}
            {viewBtn('grouped', 'Grouped')}
            {geo && viewBtn('map', 'Map')}
          </div>
        </div>

        {canScan && scanOpen && (
          <div className="mt-3">
            <ScanLeadCard onSaved={() => setScanOpen(false)} />
          </div>
        )}
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-5 text-center text-sm text-gray-500">
          {annotated.length === 0 ? 'No HD Mail In Test cards yet.' : 'No cards match your search or filter.'}
        </p>
      ) : view === 'map' && geo ? (
        <LeadsMap leads={mapLeads} stores={geo.stores} pendingStores={geo.pendingStores} />
      ) : view === 'grouped' ? (
        <>
          <div className="space-y-4">
            {(() => {
              // Break the current page into contiguous runs by group.
              const blocks: { group: string; items: typeof page }[] = [];
              for (const x of page) {
                const last = blocks[blocks.length - 1];
                if (last && last.group === x.group) last.items.push(x);
                else blocks.push({ group: x.group, items: [x] });
              }
              return blocks.map((b, bi) => (
                <div key={`${b.group}-${bi}`}>
                  <div className="mb-2 flex items-center gap-2 px-1">
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700">{GROUP_LABEL[b.group] ?? b.group}</span>
                    <span className="text-xs text-gray-400 tabular-nums">{groupTotals[b.group] ?? b.items.length}</span>
                  </div>
                  <div className="space-y-2">
                    {b.items.map((x) => (
                      <ScannedLeadRowItem key={x.l.id} lead={x.l} calls={callsByKey[scannedLeadKey(x.l.id)] ?? []} showOffice={showOffice} />
                    ))}
                  </div>
                </div>
              ));
            })()}
          </div>
          <Pager shown={page.length} total={ordered.length} onMore={() => setShown((n) => n + PAGE)} />
        </>
      ) : (
        <>
          <div className="space-y-2">
            {page.map((x) => (
              <ScannedLeadRowItem key={x.l.id} lead={x.l} calls={callsByKey[scannedLeadKey(x.l.id)] ?? []} showOffice={showOffice} />
            ))}
          </div>
          <Pager shown={page.length} total={ordered.length} onMore={() => setShown((n) => n + PAGE)} />
        </>
      )}
    </div>
  );
}

function Pager({ shown, total, onMore }: { shown: number; total: number; onMore: () => void }) {
  return (
    <div className="flex items-center justify-between pt-1 text-sm text-gray-500">
      <span className="tabular-nums">Showing {shown} of {total}</span>
      {shown < total && (
        <button type="button" onClick={onMore} className="btn-secondary text-xs">Load more</button>
      )}
    </div>
  );
}
