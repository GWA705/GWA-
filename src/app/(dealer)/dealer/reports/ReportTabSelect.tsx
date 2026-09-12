'use client';

import { useRouter } from 'next/navigation';

/**
 * Mobile report picker — a single dropdown that jumps to the chosen report.
 * Replaces the sideways-scrolling tab strip on phones, where tabs ran off-screen.
 */
export function ReportTabSelect({ items, active }: { items: { href: string; label: string; key: string }[]; active: string }) {
  const router = useRouter();
  const current = items.find((i) => i.key === active)?.href ?? items[0]?.href ?? '';
  return (
    <select
      aria-label="Choose a report"
      className="input w-full font-semibold text-blue-700"
      value={current}
      onChange={(e) => router.push(e.target.value)}
    >
      {items.map((i) => (
        <option key={i.key} value={i.href}>{i.label}</option>
      ))}
    </select>
  );
}
