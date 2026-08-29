'use client';

import { useRouter } from 'next/navigation';

/**
 * A generic filter dropdown for the leads list. Navigates on change, setting
 * `paramName` and preserving the other filters; resets paging.
 */
export function LeadsSelect({
  paramName,
  value,
  options,
  allLabel,
  ariaLabel,
  basePath,
  params,
}: {
  paramName: string;
  value: string;
  options: { value: string; label: string }[];
  allLabel: string;
  ariaLabel: string;
  basePath: string;
  params: { name: string; value: string }[];
}) {
  const router = useRouter();
  return (
    <select
      aria-label={ariaLabel}
      className="input h-9 w-auto py-1 text-sm"
      value={value}
      onChange={(e) => {
        const sp = new URLSearchParams();
        for (const p of params) if (p.value) sp.set(p.name, p.value);
        if (e.target.value) sp.set(paramName, e.target.value);
        else sp.delete(paramName);
        sp.delete('page');
        router.push(`${basePath}${sp.toString() ? `?${sp}` : ''}`);
      }}
    >
      <option value="">{allLabel}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
