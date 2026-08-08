'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { createOrderAction, type OrderActionState } from './actions';
import { MARKETPLACE_TAGS } from '@/lib/constants';

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
  featured: boolean;
  tags: string[];
}

interface Category {
  id: string;
  name: string;
}

const initial: OrderActionState = {};
const NEW_ARRIVALS = '__new__';
const ALL = '__all__';
const OTHER = '__other__';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Submitting…' : 'Submit order'}
    </button>
  );
}

function TagBadges({ tags }: { tags: string[] }) {
  const shown = MARKETPLACE_TAGS.filter((t) => tags.includes(t.key));
  if (shown.length === 0) return null;
  return (
    <div className="pointer-events-none absolute left-2 top-2 flex flex-col items-start gap-1">
      {shown.map((t) => (
        <span key={t.key} className={`badge ${t.badgeClass} shadow-sm`}>{t.label}</span>
      ))}
    </div>
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

function ItemImage({ item, onImageClick, className }: { item: Item; onImageClick: (src: string, alt: string) => void; className?: string }) {
  const imgSrc = `/api/marketplace/items/${item.id}/image`;
  return item.hasImage ? (
    <button
      type="button"
      onClick={() => onImageClick(imgSrc, item.name)}
      className={`relative block aspect-square w-full cursor-zoom-in bg-gray-50 ${className ?? ''}`}
      aria-label={`View ${item.name} larger`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imgSrc} alt={item.name} className="h-full w-full object-cover" />
      <TagBadges tags={item.tags} />
    </button>
  ) : (
    <div className={`relative flex aspect-square w-full items-center justify-center bg-gray-50 text-4xl text-gray-300 ${className ?? ''}`} aria-hidden>
      👕
      <TagBadges tags={item.tags} />
    </div>
  );
}

function ItemCard({ item, onImageClick, hidden }: { item: Item; onImageClick: (src: string, alt: string) => void; hidden?: boolean }) {
  return (
    <div className={`card flex flex-col overflow-hidden p-0 ${hidden ? 'hidden' : ''}`}>
      <ItemImage item={item} onImageClick={onImageClick} />
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

// The scrolling "New Arrivals" highlight strip. Auto-advances gently and can be
// swiped (mobile) or nudged with the arrows (desktop). Auto-motion is disabled
// for anyone who prefers reduced motion.
function NewArrivalsRail({ items, onImageClick }: { items: Item[]; onImageClick: (src: string, alt: string) => void }) {
  const scroller = useRef<HTMLDivElement>(null);
  const paused = useRef(false);

  function nudge(dir: 1 | -1) {
    const el = scroller.current;
    if (!el) return;
    const step = Math.max(200, Math.round(el.clientWidth * 0.8));
    // Wrap back to the start once we've reached the end.
    if (dir === 1 && el.scrollLeft + el.clientWidth >= el.scrollWidth - 8) {
      el.scrollTo({ left: 0, behavior: 'smooth' });
    } else {
      el.scrollBy({ left: dir * step, behavior: 'smooth' });
    }
  }

  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || items.length <= 1) return;
    const id = window.setInterval(() => {
      if (!paused.current) nudge(1);
    }, 3800);
    return () => window.clearInterval(id);
  }, [items.length]);

  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">✨ New Arrivals</h2>
        <div className="hidden gap-2 sm:flex">
          <button type="button" onClick={() => nudge(-1)} aria-label="Previous" className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-gray-50">‹</button>
          <button type="button" onClick={() => nudge(1)} aria-label="Next" className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-gray-50">›</button>
        </div>
      </div>
      <div
        ref={scroller}
        onMouseEnter={() => { paused.current = true; }}
        onMouseLeave={() => { paused.current = false; }}
        onTouchStart={() => { paused.current = true; }}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]"
      >
        {items.map((item) => (
          <div key={item.id} className="w-44 shrink-0 snap-start sm:w-48">
            <div className="card flex flex-col overflow-hidden p-0">
              <ItemImage item={item} onImageClick={onImageClick} />
              <div className="p-3">
                <div className="text-sm font-medium leading-snug text-gray-900">{item.name}</div>
                {item.description && <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{item.description}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CategoryBar({
  chips,
  active,
  onSelect,
}: {
  chips: { key: string; label: string; count: number }[];
  active: string;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="mb-5 flex gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
      {chips.map((c) => {
        const on = c.key === active;
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => onSelect(c.key)}
            aria-pressed={on}
            className={`flex-none rounded-full border px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap transition ${
              on ? 'border-transparent bg-brand-600 text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {c.label}
            <span className={`ml-1.5 ${on ? 'text-white/70' : 'text-gray-400'}`}>{c.count}</span>
          </button>
        );
      })}
    </div>
  );
}

function ItemGrid({ items, active, onImageClick }: { items: Item[]; active: string; onImageClick: (src: string, alt: string) => void }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        // Hide (don't unmount) non-featured cards while the New Arrivals filter is
        // on, so any quantities already typed elsewhere are never lost.
        <ItemCard key={item.id} item={item} onImageClick={onImageClick} hidden={active === NEW_ARRIVALS && !item.featured} />
      ))}
    </div>
  );
}

export function MarketplaceOrderForm({ items, categories }: { items: Item[]; categories: Category[] }) {
  const [state, action] = useFormState(createOrderAction, initial);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
  const [active, setActive] = useState<string>(ALL);
  const openImage = (src: string, alt: string) => setLightbox({ src, alt });

  const activeIds = new Set(categories.map((c) => c.id));
  const featured = items.filter((it) => it.featured);
  const sections = categories
    .map((c) => ({ key: c.id, name: c.name, items: items.filter((it) => it.categoryId === c.id) }))
    .filter((s) => s.items.length > 0);
  const other = items.filter((it) => !it.categoryId || !activeIds.has(it.categoryId));

  // Category chips: All, New Arrivals (if any), each populated category, Other.
  const chips = [
    { key: ALL, label: 'All', count: items.length },
    ...(featured.length > 0 ? [{ key: NEW_ARRIVALS, label: '✨ New Arrivals', count: featured.length }] : []),
    ...sections.map((s) => ({ key: s.key, label: s.name, count: s.items.length })),
    ...(other.length > 0 ? [{ key: OTHER, label: 'Other', count: other.length }] : []),
  ];

  // Whether a section is shown for the current filter.
  const sectionVisible = (key: string, secItems: Item[]) => {
    if (active === ALL) return true;
    if (active === key) return true;
    if (active === NEW_ARRIVALS) return secItems.some((it) => it.featured);
    return false;
  };

  return (
    <>
      <CategoryBar chips={chips} active={active} onSelect={setActive} />

      {featured.length > 0 && (active === ALL || active === NEW_ARRIVALS) && (
        <NewArrivalsRail items={featured} onImageClick={openImage} />
      )}

      <form action={action} className="space-y-8">
        {state.error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
            {state.error}
          </div>
        )}

        {sections.map((s) => (
          <section key={s.key} className={`space-y-3 ${sectionVisible(s.key, s.items) ? '' : 'hidden'}`}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{s.name}</h2>
            <ItemGrid items={s.items} active={active} onImageClick={openImage} />
          </section>
        ))}
        {other.length > 0 && (
          <section className={`space-y-3 ${sectionVisible(OTHER, other) ? '' : 'hidden'}`}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Other</h2>
            <ItemGrid items={other} active={active} onImageClick={openImage} />
          </section>
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
