'use client';

import { useRouter } from 'next/navigation';

// Month/year filter for the leads list. Navigates on change, preserving the
// current search, status and office selection.
export function LeadsMonthDropdown({
  value,
  options,
  basePath,
  params,
}: {
  value: string;
  options: { value: string; label: string }[];
  basePath: string;
  params: { name: string; value: string }[];
}) {
  const router = useRouter();
  return (
    <select
      aria-label="Filter by month"
      className="input h-9 w-auto py-1 text-sm"
      value={value}
      onChange={(e) => {
        const sp = new URLSearchParams();
        for (const p of params) if (p.value) sp.set(p.name, p.value);
        if (e.target.value) sp.set('month', e.target.value);
        else sp.delete('month');
        router.push(`${basePath}${sp.toString() ? `?${sp}` : ''}`);
      }}
    >
      <option value="">All months</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
