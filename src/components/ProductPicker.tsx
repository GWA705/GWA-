'use client';

import { useMemo, useState } from 'react';
import { journalCodeFromName } from '@/lib/journalCode';

export interface ProductPickerOption {
  id: string;
  name: string;
  journalName?: string | null;
  promoted?: boolean;
}

/**
 * The "Product(s) sold" picker: a searchable grid of tap-to-toggle chips plus a
 * free-text "Other" box. Each chip shows the full product name with its short
 * journal code as a small badge. Selections post as `productsSold` checkboxes and
 * `productsSoldOther` text — the same field names the old checkbox grid used, so
 * form validation and the server action are unchanged.
 *
 * A search box appears once the list is long enough to warrant it, so a growing
 * catalogue stays quick to pick from on a phone. Filtering only hides chips;
 * a chip that's checked and then filtered out stays checked and still submits.
 */
export function ProductPicker({
  products,
  selected = [],
  otherDefault = '',
  allowAddToList = false,
}: {
  products: ProductPickerOption[];
  selected?: string[];
  otherDefault?: string;
  // Show the "add these to my list for next time" opt-in under the Other box
  // (dealer new-deal form only).
  allowAddToList?: boolean;
}) {
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(selected));
  const [q, setQ] = useState('');
  const [other, setOther] = useState(otherDefault);
  const otherNames = other.split(',').map((s) => s.trim()).filter(Boolean);

  const norm = q.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!norm) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(norm) || (p.journalName ?? '').toLowerCase().includes(norm),
    );
  }, [products, norm]);

  function toggle(name: string) {
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const showSearch = products.length > 6;

  return (
    <div>
      {showSearch && (
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${products.length} products…`}
          className="input mb-2"
          autoComplete="off"
        />
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p) => {
          const on = chosen.has(p.name);
          return (
            <label
              key={p.id}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                on
                  ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500'
                  : 'border-gray-200 hover:border-brand-300 hover:bg-gray-50'
              }`}
            >
              <input
                type="checkbox"
                name="productsSold"
                value={p.name}
                checked={on}
                onChange={() => toggle(p.name)}
                className="h-4 w-4 flex-none"
              />
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              {p.journalName && (
                <span className="badge flex-none bg-white font-mono text-[10px] text-gray-500 ring-1 ring-inset ring-gray-200">
                  {p.journalName}
                </span>
              )}
              {p.promoted && !p.journalName && (
                <span className="badge flex-none bg-amber-50 text-[10px] text-amber-700">yours</span>
              )}
            </label>
          );
        })}
        {filtered.length === 0 && (
          <p className="col-span-full py-1 text-xs text-gray-400">
            No products match “{q}”. Add it under <span className="font-medium">Other</span> below.
          </p>
        )}
      </div>
      <div className="mt-2">
        <label className="flex flex-col gap-1 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm">
          <span className="font-medium text-gray-700">Other</span>
          <input
            name="productsSoldOther"
            value={other}
            onChange={(e) => setOther(e.target.value)}
            className="input"
            placeholder="Type a product not listed (separate several with commas)"
            autoComplete="off"
          />
        </label>
        {allowAddToList && otherNames.length > 0 && (
          <label className="mt-2 flex items-start gap-2 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-900">
            <input type="checkbox" name="addOtherToList" value="on" className="mt-0.5 h-4 w-4 flex-none" />
            <span>
              Add{' '}
              {otherNames.length === 1 ? (
                <>
                  <span className="font-semibold">“{otherNames[0]}”</span>{' '}
                  <span className="rounded bg-white px-1 font-mono text-xs text-sky-700 ring-1 ring-inset ring-sky-200">
                    journal code {journalCodeFromName(otherNames[0])}
                  </span>
                </>
              ) : (
                <span className="font-semibold">these {otherNames.length} products</span>
              )}{' '}
              to my product list for next time
            </span>
          </label>
        )}
      </div>
    </div>
  );
}
