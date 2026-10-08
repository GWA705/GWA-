'use client';

import { useMemo, useState } from 'react';
import { journalCodeFromName } from '@/lib/journalCode';
import { useT } from '@/i18n/client';

export interface ProductPickerOption {
  id: string;
  name: string;
  journalName?: string | null;
  promoted?: boolean;
}

/**
 * The "Product(s) sold" picker: a searchable grid of tap-to-add tiles plus a
 * free-text "Other" box. Tap a tile to add it; a selected tile shows a − N +
 * stepper so you can set how many of the same product (tapping the tile again
 * also adds one) — so a deal with two of the same product is captured, and the
 * journal UNITS count is right.
 *
 * Each chosen unit posts as its own `productsSold` hidden input (so two softeners
 * post the name twice), plus a `productsSoldOther` text field and, when the
 * catalogue is non-empty, a `productsSoldAvailable` marker the form uses to tell
 * "nothing picked yet" from "no catalogue". Field names match the old grid, so
 * the server action is unchanged (it reads getAll('productsSold')).
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
  const t = useT();
  // name -> quantity. Seeded from `selected`, which may list the same product
  // more than once (that's the quantity when editing an existing deal).
  const [qty, setQty] = useState<Map<string, number>>(() => {
    const m = new Map<string, number>();
    for (const n of selected) m.set(n, (m.get(n) ?? 0) + 1);
    return m;
  });
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

  function add(name: string) {
    setQty((prev) => new Map(prev).set(name, (prev.get(name) ?? 0) + 1));
  }
  function remove(name: string) {
    setQty((prev) => {
      const next = new Map(prev);
      const n = (next.get(name) ?? 0) - 1;
      if (n <= 0) next.delete(name);
      else next.set(name, n);
      return next;
    });
  }

  const showSearch = products.length > 6;

  // One hidden input per unit, so getAll('productsSold') returns the quantity.
  const hiddenUnits: string[] = [];
  for (const [name, n] of qty) for (let i = 0; i < n; i += 1) hiddenUnits.push(name);

  return (
    <div>
      {/* Submitted values (hidden). Tiles below only drive the UI. */}
      {products.length > 0 && <input type="hidden" name="productsSoldAvailable" value="1" />}
      {hiddenUnits.map((name, i) => (
        <input key={`${name}-${i}`} type="hidden" name="productsSold" value={name} />
      ))}

      {showSearch && (
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('productPicker.searchPlaceholder', { n: products.length })}
          className="input mb-2"
          autoComplete="off"
        />
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p) => {
          const n = qty.get(p.name) ?? 0;
          const on = n > 0;
          return (
            <div
              key={p.id}
              role="button"
              tabIndex={0}
              aria-pressed={on}
              onClick={() => add(p.name)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); add(p.name); } }}
              className={`relative flex cursor-pointer select-none items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                on
                  ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500'
                  : 'border-gray-200 hover:border-brand-300 hover:bg-gray-50'
              }`}
            >
              <span
                className={`flex h-4 w-4 flex-none items-center justify-center rounded border text-[10px] font-bold leading-none ${
                  on ? 'border-brand-600 bg-brand-600 text-white' : 'border-gray-300'
                }`}
                aria-hidden
              >
                {on ? '✓' : ''}
              </span>
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              {p.journalName && (
                <span className="badge flex-none bg-white font-mono text-[10px] text-gray-500 ring-1 ring-inset ring-gray-200">
                  {p.journalName}
                </span>
              )}
              {p.promoted && !p.journalName && (
                <span className="badge flex-none bg-amber-50 text-[10px] text-amber-700">{t('productPicker.yours')}</span>
              )}
              {on && (
                /* − N +  stepper: visible count with explicit add/remove. */
                <span className="flex flex-none items-center overflow-hidden rounded-md border border-brand-300 bg-white">
                  <button
                    type="button"
                    aria-label={`Remove one ${p.name}`}
                    onClick={(e) => { e.stopPropagation(); remove(p.name); }}
                    className="flex h-6 w-6 items-center justify-center text-base leading-none text-brand-700 hover:bg-brand-100"
                  >
                    −
                  </button>
                  <span className="min-w-[1.5rem] px-0.5 text-center text-xs font-bold tabular-nums text-brand-800">{n}</span>
                  <button
                    type="button"
                    aria-label={`Add one ${p.name}`}
                    onClick={(e) => { e.stopPropagation(); add(p.name); }}
                    className="flex h-6 w-6 items-center justify-center text-base leading-none text-brand-700 hover:bg-brand-100"
                  >
                    +
                  </button>
                </span>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="col-span-full py-1 text-xs text-gray-400">
            {t('productPicker.noMatchPre', { q })} <span className="font-medium">{t('productPicker.otherInline')}</span> {t('productPicker.noMatchPost')}
          </p>
        )}
      </div>
      <p className="mt-1 text-xs text-gray-400">Tap a product to add it · use − / + to set how many</p>
      <div className="mt-2">
        <label className="flex flex-col gap-1 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm">
          <span className="font-medium text-gray-700">{t('productPicker.otherLabel')}</span>
          <input
            name="productsSoldOther"
            value={other}
            onChange={(e) => setOther(e.target.value)}
            className="input"
            placeholder={t('productPicker.otherPlaceholder')}
            autoComplete="off"
          />
        </label>
        {allowAddToList && otherNames.length > 0 && (
          <label className="mt-2 flex items-start gap-2 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-900">
            <input type="checkbox" name="addOtherToList" value="on" className="mt-0.5 h-4 w-4 flex-none" />
            <span>
              {t('productPicker.addPrefix')}{' '}
              {otherNames.length === 1 ? (
                <>
                  <span className="font-semibold">“{otherNames[0]}”</span>{' '}
                  <span className="rounded bg-white px-1 font-mono text-xs text-sky-700 ring-1 ring-inset ring-sky-200">
                    {t('productPicker.journalCode', { code: journalCodeFromName(otherNames[0]) })}
                  </span>
                </>
              ) : (
                <span className="font-semibold">{t('productPicker.theseProducts', { n: otherNames.length })}</span>
              )}{' '}
              {t('productPicker.toMyListSuffix')}
            </span>
          </label>
        )}
      </div>
    </div>
  );
}
