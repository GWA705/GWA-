'use client';

import { useMemo, useState, type ReactNode } from 'react';

/**
 * Client controls for the combined "All leads" view. It receives ready-made rows
 * (built server-side with each source's native component, so booking / call-logging
 * still work) plus the metadata to search/filter/sort by, and shows the matching
 * rows. See CombinedLeadsView for why the rows are built on the server.
 */

type Kind = 'mailin' | 'store';
type SortKey = 'newest' | 'oldest' | 'name' | 'store';

export interface CombinedItem {
  key: string;
  kind: Kind;
  name: string;
  store: string;
  search: string;
  date: number;
  group: string;
  node: ReactNode;
}

const STATUSES: { k: string; label: string }[] = [
  { k: 'all', label: 'All' },
  { k: 'new', label: 'New' },
  { k: 'working', label: 'Working' },
  { k: 'spoke', label: 'Spoke' },
  { k: 'booked', label: 'Booked' },
  { k: 'sold', label: 'Sold' },
  { k: 'nogood', label: 'No good' },
];

function chipClass(active: boolean) {
  return `rounded-full px-3 py-1 text-xs font-medium transition ${
    active ? 'bg-gray-900 text-white' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
  }`;
}

export function CombinedLeadsControls({ items }: { items: CombinedItem[] }) {
  const [q, setQ] = useState('');
  const [source, setSource] = useState<'all' | Kind>('all');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState<SortKey>('newest');

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const it of items) c[it.group] = (c[it.group] ?? 0) + 1;
    return c;
  }, [items]);
  const mailinCount = useMemo(() => items.filter((i) => i.kind === 'mailin').length, [items]);
  const storeCount = items.length - mailinCount;

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = items.filter((it) => {
      if (source !== 'all' && it.kind !== source) return false;
      if (status !== 'all' && it.group !== status) return false;
      if (needle && !it.search.includes(needle)) return false;
      return true;
    });
    return rows.sort((a, b) => {
      switch (sort) {
        case 'oldest':
          return a.date - b.date;
        case 'name':
          return a.name.localeCompare(b.name);
        case 'store':
          return a.store.localeCompare(b.store) || b.date - a.date;
        default:
          return b.date - a.date; // newest
      }
    });
  }, [items, q, source, status, sort]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, phone, store, city…"
          className="input min-w-[220px] flex-1"
          aria-label="Search leads"
        />
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="input w-auto text-sm" aria-label="Sort">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="name">Name A–Z</option>
          <option value="store">By store</option>
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={() => setSource('all')} className={chipClass(source === 'all')}>All ({items.length})</button>
        <button type="button" onClick={() => setSource('mailin')} className={chipClass(source === 'mailin')}>Mail in ({mailinCount})</button>
        <button type="button" onClick={() => setSource('store')} className={chipClass(source === 'store')}>Store ({storeCount})</button>
        <span className="mx-1 h-4 w-px bg-gray-200" aria-hidden />
        {STATUSES.map((d) => (
          <button key={d.k} type="button" onClick={() => setStatus(d.k)} className={chipClass(status === d.k)}>
            {d.label}{d.k !== 'all' && statusCounts[d.k] ? ` ${statusCounts[d.k]}` : ''}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="card p-8 text-center text-sm text-gray-500">
          {items.length === 0 ? 'No leads for this view yet.' : 'No leads match your search or filters.'}
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((it) => (
            <div key={it.key}>{it.node}</div>
          ))}
        </div>
      )}
    </div>
  );
}
