'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { QUEUE_SORTS } from '@/lib/sortOptions';

/** Sort control for the reviewer Deals queue (applies to the All tab + search). */
export function QueueSortControl({ sort, basePath = '/staff' }: { sort: string; basePath?: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  function setSort(value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value && value !== 'newest') next.set('sort', value);
    else next.delete('sort');
    router.push(next.toString() ? `${basePath}?${next.toString()}` : basePath);
  }
  return (
    <label className="flex items-center gap-1.5 text-xs text-gray-500">
      <span className="font-medium">Sort</span>
      <select
        value={sort}
        onChange={(e) => setSort(e.target.value)}
        className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800"
      >
        {QUEUE_SORTS.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>
    </label>
  );
}
