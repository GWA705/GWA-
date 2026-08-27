'use client';

import { useRef } from 'react';

const STATUS_OPTS = [
  { value: '', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'SENT', label: 'Sent' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const SELECT = 'rounded-md border border-gray-300 bg-white px-2 py-2 text-sm text-gray-800';

/**
 * Search + filter bar for the gift-card lists. A plain GET form so every control
 * (search text, status, month, sort) is submitted together and preserved;
 * selects auto-submit on change. Paging state lives in the URL and is reset on
 * any filter change (page is intentionally not a field here).
 */
export function GiftCardBrowseControls({
  basePath,
  q,
  status,
  month,
  sort,
  perPage,
  months,
  showStatus = true,
}: {
  basePath: string;
  q: string;
  status: string;
  month: string;
  sort: string;
  perPage: string;
  months: { value: string; label: string }[];
  showStatus?: boolean;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const submit = () => ref.current?.requestSubmit();

  return (
    <form ref={ref} method="get" action={basePath} className="flex flex-wrap items-center gap-2">
      <input
        type="search"
        name="q"
        defaultValue={q}
        placeholder="Search name, email or cell…"
        className="input min-w-[180px] flex-1 text-sm"
        aria-label="Search gift cards"
      />
      {showStatus && (
        <select name="status" defaultValue={status} onChange={submit} className={SELECT} aria-label="Status">
          {STATUS_OPTS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}
      <select name="month" defaultValue={month} onChange={submit} className={SELECT} aria-label="Month">
        <option value="">All months</option>
        {months.map((m) => (
          <option key={m.value} value={m.value}>{m.label}</option>
        ))}
      </select>
      <select name="sort" defaultValue={sort} onChange={submit} className={SELECT} aria-label="Sort">
        <option value="newest">Newest first</option>
        <option value="oldest">Oldest first</option>
      </select>
      <input type="hidden" name="perPage" value={perPage} />
      <button type="submit" className="btn-secondary text-sm">Search</button>
    </form>
  );
}
