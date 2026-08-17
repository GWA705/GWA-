'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * GET search form. Submits `q` to the given action path on Search/Enter. When
 * the box is emptied (deleted or the native clear button), it navigates straight
 * back to the full list — dropping `q` but keeping any status/sort filters — so
 * you don't get stuck on a "no results" screen. Shows a Clear link when a search
 * is active.
 */
export function SearchBox({
  action,
  q,
  placeholder = 'Search name or reference #…',
}: {
  action: string;
  q?: string;
  placeholder?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(q ?? '');
  const active = (q ?? '') !== '';

  // Go back to the unfiltered list — keep other filters, drop q + page.
  function resetToList() {
    const sp = new URLSearchParams(params?.toString() ?? '');
    sp.delete('q');
    sp.delete('page');
    const qs = sp.toString();
    router.push(qs ? `${action}?${qs}` : action);
  }

  return (
    <form action={action} method="get" className="flex w-full items-center gap-2 sm:w-auto">
      <input
        type="search"
        name="q"
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          setValue(v);
          // Emptied the box while a search was active → show all deals again.
          if (v.trim() === '' && active) resetToList();
        }}
        placeholder={placeholder}
        className="input h-9 w-full min-w-0 py-1 sm:w-64"
        aria-label="Search"
      />
      <button type="submit" className="btn-secondary h-9 py-1 text-sm">Search</button>
      {active && (
        <button
          type="button"
          onClick={() => { setValue(''); resetToList(); }}
          className="text-sm text-gray-500 hover:underline"
        >
          Clear
        </button>
      )}
    </form>
  );
}
