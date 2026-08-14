'use client';

import { useRouter, useSearchParams } from 'next/navigation';

export const DEALER_SORTS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'amount_high', label: 'Amount: high → low' },
  { value: 'amount_low', label: 'Amount: low → high' },
  { value: 'name', label: 'Name: A → Z' },
  { value: 'status', label: 'Status' },
] as const;

/** Filter (by status) + sort controls for the dealer Applications list. */
export function DealerListControls({
  status,
  sort,
  statuses,
}: {
  status: string;
  sort: string;
  statuses: { value: string; label: string }[];
}) {
  const router = useRouter();
  const sp = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.set('page', '1'); // any filter/sort change goes back to the first page
    router.push(`/dealer?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-1.5 text-xs text-gray-500">
        <span className="font-medium">Status</span>
        <select
          value={status}
          onChange={(e) => setParam('status', e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800"
        >
          <option value="">All</option>
          {statuses.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1.5 text-xs text-gray-500">
        <span className="font-medium">Sort</span>
        <select
          value={sort}
          onChange={(e) => setParam('sort', e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800"
        >
          {DEALER_SORTS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
