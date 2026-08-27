'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

const SIZES = [25, 50, 100];

/**
 * Per-page selector (25 / 50 / 100 / All) plus prev/next paging for the
 * gift-card lists. Builds URLs from the current query string so search, status,
 * month and sort are all preserved as you page or change the page size.
 */
export function GiftCardPager({
  basePath,
  perPage,
  page,
  pageCount,
  firstShown,
  lastShown,
  total,
}: {
  basePath: string;
  perPage: number | 'all';
  page: number;
  pageCount: number;
  firstShown: number;
  lastShown: number;
  total: number;
}) {
  const sp = useSearchParams();
  const build = (over: Record<string, string>) => {
    const next = new URLSearchParams(sp?.toString() ?? '');
    for (const [k, v] of Object.entries(over)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const qs = next.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-gray-500">
      <div className="flex items-center gap-1">
        <span>Show</span>
        {SIZES.map((n) => (
          <Link
            key={n}
            href={build({ perPage: String(n), page: '1' })}
            className={`rounded px-2 py-1 ${String(n) === String(perPage) ? 'bg-brand-100 font-semibold text-brand-800' : 'hover:bg-gray-100'}`}
          >
            {n}
          </Link>
        ))}
        <Link
          href={build({ perPage: 'all', page: '1' })}
          className={`rounded px-2 py-1 ${perPage === 'all' ? 'bg-brand-100 font-semibold text-brand-800' : 'hover:bg-gray-100'}`}
        >
          All
        </Link>
        <span>per page</span>
      </div>
      <div className="flex items-center gap-2">
        <span>{firstShown}–{lastShown} of {total}</span>
        {pageCount > 1 && perPage !== 'all' && (
          <>
            {page > 1 ? (
              <Link href={build({ page: String(page - 1) })} className="rounded border border-gray-200 px-2 py-1 hover:bg-gray-50">← Prev</Link>
            ) : (
              <span className="rounded border border-gray-100 px-2 py-1 text-gray-300">← Prev</span>
            )}
            <span>Page {page} of {pageCount}</span>
            {page < pageCount ? (
              <Link href={build({ page: String(page + 1) })} className="rounded border border-gray-200 px-2 py-1 hover:bg-gray-50">Next →</Link>
            ) : (
              <span className="rounded border border-gray-100 px-2 py-1 text-gray-300">Next →</span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
