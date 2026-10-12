'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { DEALER_SORTS } from '@/lib/sortOptions';
import { useT } from '@/i18n/client';

// Maps the stable sort codes in DEALER_SORTS (a server-safe module const that
// can't call t()) to translation keys.
const SORT_KEY: Record<string, string> = {
  newest: 'leadUi.sort.newest',
  oldest: 'leadUi.sort.oldest',
  amount_high: 'leadUi.sort.amountHigh',
  amount_low: 'leadUi.sort.amountLow',
  name: 'leadUi.sort.nameArrow',
  status: 'leadUi.sort.status',
};

/** Filter (by status) + sort controls for the dealer Applications list. */
export function DealerListControls({
  status,
  sort,
  statuses,
  basePath = '/dealer',
}: {
  status: string;
  sort: string;
  statuses: { value: string; label: string }[];
  basePath?: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const t = useT();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.set('page', '1'); // any filter/sort change goes back to the first page
    router.push(`${basePath}?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-1.5 text-xs text-gray-500">
        <span className="font-medium">{t('leadUi.filter.status')}</span>
        <select
          value={status}
          onChange={(e) => setParam('status', e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800"
        >
          <option value="">{t('common.all')}</option>
          {statuses.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1.5 text-xs text-gray-500">
        <span className="font-medium">{t('common.sort')}</span>
        <select
          value={sort}
          onChange={(e) => setParam('sort', e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800"
        >
          {DEALER_SORTS.map((s) => (
            <option key={s.value} value={s.value}>{SORT_KEY[s.value] ? t(SORT_KEY[s.value]) : s.label}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
