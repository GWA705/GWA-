'use client';

import { useRouter } from 'next/navigation';

/**
 * Brand filter + sort controls for the resource library. Navigates on change,
 * preserving the current search text and category. Kept as a small client island
 * so the page itself stays a server component.
 */
export function LibraryFilters({
  brands,
  q,
  cat,
  brand,
  sort,
}: {
  brands: string[];
  q: string;
  cat: string;
  brand: string;
  sort: string;
}) {
  const router = useRouter();

  function go(next: Partial<{ brand: string; sort: string }>) {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (cat) p.set('cat', cat);
    const b = next.brand ?? brand;
    const s = next.sort ?? sort;
    if (b) p.set('brand', b);
    if (s && s !== 'featured') p.set('sort', s);
    router.push(`/dealer/resources/library${p.toString() ? `?${p}` : ''}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {brands.length > 0 && (
        <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
          <span className="hidden sm:inline">Brand</span>
          <select
            value={brand}
            onChange={(e) => go({ brand: e.target.value })}
            className="input w-auto py-1.5 text-sm"
            aria-label="Filter by brand"
          >
            <option value="">All brands</option>
            {brands.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </label>
      )}
      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
        <span className="hidden sm:inline">Sort</span>
        <select
          value={sort || 'featured'}
          onChange={(e) => go({ sort: e.target.value })}
          className="input w-auto py-1.5 text-sm"
          aria-label="Sort products"
        >
          <option value="featured">Featured</option>
          <option value="name">Name (A–Z)</option>
          <option value="brand">Brand (A–Z)</option>
        </select>
      </label>
    </div>
  );
}
