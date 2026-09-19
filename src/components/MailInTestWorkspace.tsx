'use client';

import { useMemo, useState } from 'react';
import { ScannedLeadsList, type ScannedLeadRow } from './ScannedLeadsList';
import { scannedGroupKey } from '@/lib/scannedLeadStatus';
import { ScanLeadCard } from './ScanLeadCard';
import type { LeadCallRow } from '@/lib/leadCalls';
import { scannedLeadKey } from '@/lib/scannedLeadKey';

/**
 * The "HD Mail In Test" workspace: a toolbar (search · sort · status filter · the
 * tucked-away scanner) over the mail-in test-card leads, paged so a long list
 * never runs off the bottom. The scanner lives here as a compact "＋ Scan cards"
 * button rather than a big always-open box. Rows themselves are the shared
 * ScannedLeadsList.
 */

const STATUS_DEFS = [
  { k: 'new', label: 'New' },
  { k: 'working', label: 'Working' },
  { k: 'spoke', label: 'Spoke' },
  { k: 'booked', label: 'Booked' },
  { k: 'sold', label: 'Sold' },
  { k: 'nogood', label: 'No good' },
];

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

export function MailInTestWorkspace({
  leads,
  callsByKey = {},
  showOffice = false,
  canScan = false,
}: {
  leads: ScannedLeadRow[];
  callsByKey?: Record<string, LeadCallRow[]>;
  showOffice?: boolean;
  canScan?: boolean;
}) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('new');
  const [status, setStatus] = useState('all');
  const [shown, setShown] = useState(PAGE);
  const [scanOpen, setScanOpen] = useState(false);

  // Annotate each lead with its calls + status group once.
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
        default: // 'new' — newest scanned first
          return b.l.createdAt.localeCompare(a.l.createdAt);
      }
    });
    return rows;
  }, [annotated, q, status, sort]);

  const page = filtered.slice(0, shown);

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setShown(PAGE);
            }}
            placeholder="Search name, phone, store, city…"
            aria-label="Search HD Mail In Test"
            className="input flex-1"
          />
          <div className="flex gap-2">
            <label className="sr-only" htmlFor="mailin_sort">Sort</label>
            <select
              id="mailin_sort"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="input w-full sm:w-auto"
            >
              {SORTS.map((s) => (
                <option key={s.k} value={s.k}>{s.label}</option>
              ))}
            </select>
            {canScan && (
              <button
                type="button"
                onClick={() => setScanOpen((v) => !v)}
                aria-expanded={scanOpen}
                className="btn-primary whitespace-nowrap"
              >
                {scanOpen ? '× Close' : '＋ Scan cards'}
              </button>
            )}
          </div>
        </div>

        {/* Status filter chips */}
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
          {[{ k: 'all', label: 'All' }, ...STATUS_DEFS].map((d) => {
            const n = counts[d.k] ?? 0;
            if (d.k !== 'all' && n === 0) return null;
            const active = status === d.k;
            return (
              <button
                key={d.k}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setStatus(d.k);
                  setShown(PAGE);
                }}
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

        {canScan && scanOpen && (
          <div className="mt-3">
            <ScanLeadCard onSaved={() => setScanOpen(false)} />
          </div>
        )}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-5 text-center text-sm text-gray-500">
          {annotated.length === 0
            ? 'No HD Mail In Test cards yet.'
            : 'No cards match your search or filter.'}
        </p>
      ) : (
        <>
          <ScannedLeadsList leads={page.map((x) => x.l)} callsByKey={callsByKey} showOffice={showOffice} />
          <div className="flex items-center justify-between pt-1 text-sm text-gray-500">
            <span className="tabular-nums">Showing {page.length} of {filtered.length}</span>
            {page.length < filtered.length && (
              <button type="button" onClick={() => setShown((n) => n + PAGE)} className="btn-secondary text-xs">
                Load more
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
