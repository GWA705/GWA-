'use client';

import { useRef } from 'react';
import { useT } from '@/i18n/client';

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
  const t = useT();
  const ref = useRef<HTMLFormElement>(null);
  const submit = () => ref.current?.requestSubmit();
  const statusOpts = [
    { value: '', label: t('giftCards.allStatuses') },
    { value: 'PENDING', label: t('giftCards.pending') },
    { value: 'SENT', label: t('giftCards.sentBadge').replace('✓ ', '') },
    { value: 'CANCELLED', label: t('giftCards.cancelled') },
  ];

  return (
    <form ref={ref} method="get" action={basePath} className="flex flex-wrap items-center gap-2">
      <input
        type="search"
        name="q"
        defaultValue={q}
        placeholder={t('giftCards.searchPlaceholder')}
        className="input min-w-[180px] flex-1 text-sm"
        aria-label={t('giftCards.searchAria')}
      />
      {showStatus && (
        <select name="status" defaultValue={status} onChange={submit} className={SELECT} aria-label={t('giftCards.statusAria')}>
          {statusOpts.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}
      <select name="month" defaultValue={month} onChange={submit} className={SELECT} aria-label={t('giftCards.monthAria')}>
        <option value="">{t('giftCards.allMonths')}</option>
        {months.map((m) => (
          <option key={m.value} value={m.value}>{m.label}</option>
        ))}
      </select>
      <select name="sort" defaultValue={sort} onChange={submit} className={SELECT} aria-label={t('giftCards.sortAria')}>
        <option value="newest">{t('giftCards.newestFirst')}</option>
        <option value="oldest">{t('giftCards.oldestFirst')}</option>
      </select>
      <input type="hidden" name="perPage" value={perPage} />
      <button type="submit" className="btn-secondary text-sm">{t('giftCards.search')}</button>
    </form>
  );
}
