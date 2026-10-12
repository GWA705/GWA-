'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useT } from '@/i18n/client';

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

const STATUS_KEYS = ['all', 'new', 'working', 'spoke', 'booked', 'sold', 'nogood'];

function chipClass(active: boolean) {
  return `rounded-full px-3 py-1 text-xs font-medium transition ${
    active ? 'bg-gray-900 text-white' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
  }`;
}

export function CombinedLeadsControls({ items }: { items: CombinedItem[] }) {
  const t = useT();
  const statusLabel = (k: string) => (k === 'all' ? t('common.all') : t(`leadUi.status.${k}`));
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
          placeholder={t('leadUi.search.placeholderFull')}
          className="input min-w-[220px] flex-1"
          aria-label="Search leads"
        />
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="input w-auto text-sm" aria-label="Sort">
          <option value="newest">{t('leadUi.sort.newest')}</option>
          <option value="oldest">{t('leadUi.sort.oldest')}</option>
          <option value="name">{t('leadUi.sort.nameAz')}</option>
          <option value="store">{t('leadUi.sort.byStore')}</option>
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={() => setSource('all')} className={chipClass(source === 'all')}>{t('common.all')} ({items.length})</button>
        <button type="button" onClick={() => setSource('mailin')} className={chipClass(source === 'mailin')}>{t('leadUi.source.mailIn', { count: mailinCount })}</button>
        <button type="button" onClick={() => setSource('store')} className={chipClass(source === 'store')}>{t('leadUi.source.store', { count: storeCount })}</button>
        <span className="mx-1 h-4 w-px bg-gray-200" aria-hidden />
        {STATUS_KEYS.map((k) => (
          <button key={k} type="button" onClick={() => setStatus(k)} className={chipClass(status === k)}>
            {statusLabel(k)}{k !== 'all' && statusCounts[k] ? ` ${statusCounts[k]}` : ''}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="card p-8 text-center text-sm text-gray-500">
          {items.length === 0 ? t('leadUi.empty.noneView') : t('leadUi.empty.noMatch')}
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
