'use client';

import { useEffect, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { createOrderAction, type OrderActionState } from './actions';

interface Item {
  id: string;
  name: string;
  description: string | null;
  options: string[];
  hasImage: boolean;
  categoryId: string | null;
  kind: string;
  hasFile: boolean;
  fileName: string | null;
}

interface Category {
  id: string;
  name: string;
}

const initial: OrderActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Submitting…' : 'Submit order'}
    </button>
  );
}

// Full-size image shown over the marketplace; closes on ✕, backdrop click, or Esc.
function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
    >
      <div className="relative max-h-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute -right-3 -top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white text-lg text-gray-700 shadow-lg ring-1 ring-gray-200 hover:bg-gray-100"
        >
          ✕
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="max-h-[85vh] w-auto rounded-lg bg-white object-contain shadow-2xl" />
      </div>
    </div>
  );
}

function ItemCard({ item, onImageClick }: { item: Item; onImageClick: (src: string, alt: string) => void }) {
  const imgSrc = `/api/marketplace/items/${item.id}/image`;
  return (
    <div className="card flex flex-col overflow-hidden p-0">
      {item.hasImage ? (
        <button
          type="button"
          onClick={() => onImageClick(imgSrc, item.name)}
          className="block aspect-square w-full cursor-zoom-in bg-gray-50"
          aria-label={`View ${item.name} larger`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imgSrc} alt={item.name} className="h-full w-full object-cover" />
        </button>
      ) : (
        <div className="flex aspect-square w-full items-center justify-center bg-gray-50 text-4xl text-gray-300" aria-hidden>👕</div>
      )}
      <div className="flex flex-1 flex-col p-4">
        <div className="font-medium text-gray-900">{item.name}</div>
        {item.description && <p className="mt-1 text-sm text-gray-500">{item.description}</p>}
        {item.kind === 'DOWNLOAD' ? (
          <div className="mt-auto pt-4">
            {item.hasFile ? (
              <a
                href={`/api/marketplace/items/${item.id}/file`}
                className="btn-primary inline-flex w-full items-center justify-center gap-2"
              >
                ⬇ Download{item.fileName ? '' : ' file'}
              </a>
            ) : (
              <p className="text-sm text-gray-400">Coming soon</p>
            )}
          </div>
        ) : (
          <div className="mt-auto flex items-end gap-2 pt-4">
            {item.options.length > 0 && (
              <div className="flex-1">
                <label className="label" htmlFor={`opt_${item.id}`}>Option</label>
                <select id={`opt_${item.id}`} name={`opt_${item.id}`} className="input">
                  {item.options.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="w-20">
              <label className="label" htmlFor={`qty_${item.id}`}>Qty</label>
              <input id={`qty_${item.id}`} name={`qty_${item.id}`} type="number" min="0" defaultValue={0} className="input" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ItemGrid({ items, onImageClick }: { items: Item[]; onImageClick: (src: string, alt: string) => void }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <ItemCard key={item.id} item={item} onImageClick={onImageClick} />
      ))}
    </div>
  );
}

export function MarketplaceOrderForm({ items, categories }: { items: Item[]; categories: Category[] }) {
  const [state, action] = useFormState(createOrderAction, initial);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
  const openImage = (src: string, alt: string) => setLightbox({ src, alt });

  // Group items under their category (in the admin-defined order). Items with no
  // category — or whose category is hidden — fall into an "Other" section.
  const activeIds = new Set(categories.map((c) => c.id));
  const sections = categories
    .map((c) => ({ name: c.name, items: items.filter((it) => it.categoryId === c.id) }))
    .filter((s) => s.items.length > 0);
  const other = items.filter((it) => !it.categoryId || !activeIds.has(it.categoryId));
  const useHeadings = sections.length > 0;

  return (
    <>
    <form action={action} className="space-y-8">
      {state.error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {state.error}
        </div>
      )}

      {useHeadings ? (
        <>
          {sections.map((s) => (
            <section key={s.name} className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{s.name}</h2>
              <ItemGrid items={s.items} onImageClick={openImage} />
            </section>
          ))}
          {other.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Other</h2>
              <ItemGrid items={other} onImageClick={openImage} />
            </section>
          )}
        </>
      ) : (
        <ItemGrid items={items} onImageClick={openImage} />
      )}

      <div className="card p-4">
        <label className="label" htmlFor="note">Note <span className="font-normal text-gray-400">(optional)</span></label>
        <textarea id="note" name="note" rows={3} className="input" placeholder="Anything the fulfillment team should know…" />
      </div>

      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
    {lightbox && <Lightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />}
    </>
  );
}
