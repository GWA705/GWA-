import Link from 'next/link';

export type LeadsTab = 'all' | 'mailin' | 'store';

/**
 * The Leads view switcher: All · HD Mail In Test · Store. Server-rendered links
 * (so it works without client JS and is shareable), driven by the `?tab=` query
 * param. Switching tabs starts fresh — it drops the store-only search/filter
 * params so the two views don't bleed into each other.
 */
export function LeadsTabs({
  tab,
  basePath,
  counts,
}: {
  tab: LeadsTab;
  basePath: string;
  counts: { all: number; mailin: number; store: number };
}) {
  const tabs: { k: LeadsTab; label: string }[] = [
    { k: 'all', label: 'All' },
    { k: 'mailin', label: 'HD Mail In Test' },
    { k: 'store', label: 'Store' },
  ];
  return (
    <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Lead type">
      {tabs.map((t) => {
        const active = tab === t.k;
        const href = t.k === 'all' ? basePath : `${basePath}?tab=${t.k}`;
        return (
          <Link
            key={t.k}
            href={href}
            role="tab"
            aria-selected={active}
            className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-bold transition ${
              active
                ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {t.label}
            <span
              className={`rounded-full px-1.5 text-xs font-extrabold tabular-nums ${
                active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {counts[t.k]}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
