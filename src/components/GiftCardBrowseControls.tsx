'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

const STATUS = [
  { v: '', l: 'All' },
  { v: 'PENDING', l: 'Pending' },
  { v: 'SENT', l: 'Sent' },
  { v: 'CANCELLED', l: 'Cancelled' },
];
const SORT = [
  { v: 'newest', l: 'Newest' },
  { v: 'oldest', l: 'Oldest' },
];

function Pill({ active, href, children }: { active: boolean; href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        active ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      {children}
    </Link>
  );
}

/**
 * Search + filter controls for the gift-card lists, rendered as button rows
 * (status, sort, month) instead of dropdowns. Each button is a link that sets
 * its param and resets to page 1, preserving the others; search navigates on
 * submit. Paging/per-page live in the URL and are preserved.
 */
export function GiftCardBrowseControls({
  basePath,
  q,
  status,
  month,
  sort,
  months,
  showStatus = true,
}: {
  basePath: string;
  q: string;
  status: string;
  month: string;
  sort: string;
  months: { value: string; label: string }[];
  showStatus?: boolean;
}) {
  const sp = useSearchParams();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const build = (over: Record<string, string>) => {
    const next = new URLSearchParams(sp?.toString() ?? '');
    for (const [k, v] of Object.entries(over)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete('page'); // any filter/search change returns to the first page
    const qs = next.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(build({ q: (inputRef.current?.value ?? '').trim() }));
  };

  return (
    <div className="space-y-2">
      <form onSubmit={submitSearch} className="flex items-center gap-2">
        <input
          ref={inputRef}
          key={q}
          defaultValue={q}
          type="search"
          placeholder="Search name, email or cell…"
          className="input min-w-[180px] flex-1 text-sm"
          aria-label="Search gift cards"
        />
        <button type="submit" className="btn-secondary text-sm">Search</button>
        {q && (
          <Link href={build({ q: '' })} className="text-xs text-gray-500 underline">clear</Link>
        )}
      </form>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {showStatus && (
          <div className="flex flex-wrap items-center gap-1.5">
            {STATUS.map((s) => (
              <Pill key={s.v} active={status === s.v} href={build({ status: s.v })}>{s.l}</Pill>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          {SORT.map((s) => (
            <Pill key={s.v} active={sort === s.v} href={build({ sort: s.v === 'newest' ? '' : s.v })}>{s.l}</Pill>
          ))}
        </div>
      </div>

      {months.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Pill active={!month} href={build({ month: '' })}>All months</Pill>
          {months.map((m) => (
            <Pill key={m.value} active={month === m.value} href={build({ month: m.value })}>{m.label}</Pill>
          ))}
        </div>
      )}
    </div>
  );
}
