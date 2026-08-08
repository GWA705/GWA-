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
      className={`relative block aspect-square w-full cursor-zoom-in border-b border-gray-200 bg-[#ffffff] ${className ?? ''}`}
      aria-label={`View ${item.name} larger`}
    >
      {/* Fit the whole product in a uniform white tile (no cropping), so text-y
          items like cards/envelopes stay fully legible and every card is the
          same height. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imgSrc} alt={item.name} className="h-full w-full object-contain p-3" />
      <TagBadges tags={item.tags} />
    </button>
  ) : (
    <div className={`relative flex aspect-square w-full items-center justify-center border-b border-gray-200 bg-[#ffffff] text-4xl text-gray-300 ${className ?? ''}`} aria-hidden>
      👕
      <TagBadges tags={item.tags} />
    </div>
  );
}

function ItemCard({ item, onImageClick, hidden }: { item: Item; onImageClick: (src: string, alt: string) => void; hidden?: boolean }) {
  return (
    <div className={`card flex flex-col overflow-hidden p-0 transition hover:shadow-md ${hidden ? 'hidden' : ''}`}>
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
    <section className="mb-8 rounded-2xl border border-gray-200 bg-gray-50/70 p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">✨ New Arrivals</h2>
          <p className="text-xs text-gray-500">Just added to the marketplace</p>
        </div>
        <div className="hidden gap-2 sm:flex">
          <button type="button" onClick={() => nudge(-1)} aria-label="Previous" className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm transition hover:bg-gray-50">‹</button>
          <button type="button" onClick={() => nudge(1)} aria-label="Next" className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm transition hover:bg-gray-50">›</button>
        </div>
      </div>
      <div
        ref={scroller}
        onMouseEnter={() => { paused.current = true; }}
        onMouseLeave={() => { paused.current = false; }}
        onTouchStart={() => { paused.current = true; }}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]"
      >
        {items.map((item) => (
          // Few items grow to fill the row (no empty gap on desktop); many items
          // keep a comfortable width and the row scrolls.
          <article key={item.id} className="group flex min-w-[15rem] max-w-[22rem] flex-1 basis-64 snap-start flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <ItemImage item={item} onImageClick={onImageClick} />
            <div className="p-4">
              <div className="font-semibold leading-snug text-gray-900">{item.name}</div>
              {item.description && <p className="mt-1 line-clamp-2 text-sm text-gray-500">{item.description}</p>}
            </div>
          </article>
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
    // Dedicated, wrapping chip area — every category stays visible and tappable
    // (no horizontal scroll that hides the last few on a phone).
    <div className="mb-5 flex flex-wrap gap-2">
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

// One category on the storefront. On the "All" view each category is minimized
// to a tappable header (so the page stays short); tapping expands its products
// inline. When a single category is selected from the chips it always shows
// expanded. Grids are hidden with CSS rather than unmounted, so any quantities a
// dealer has already typed are never lost when they collapse/switch categories.
function SectionBlock({
  sectionKey,
  name,
  secItems,
  active,
  open,
  onToggle,
  onImageClick,
  visible,
}: {
  sectionKey: string;
  name: string;
  secItems: Item[];
  active: string;
  open: boolean;
  onToggle: (key: string) => void;
  onImageClick: (src: string, alt: string) => void;
  visible: boolean;
}) {
  const collapsible = active === ALL;
  const gridHidden = collapsible && !open;
  return (
    <section className={`space-y-3 ${visible ? '' : 'hidden'}`}>
      {collapsible ? (
        <button
          type="button"
          onClick={() => onToggle(sectionKey)}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-left shadow-sm transition hover:bg-gray-50"
        >
          <span className="flex items-center gap-2">
            <span className="font-semibold text-gray-900">{name}</span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">{secItems.length}</span>
          </span>
          <svg
            viewBox="0 0 20 20"
            className={`h-5 w-5 flex-none text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : (
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{name}</h2>
      )}
      <div className={gridHidden ? 'hidden' : ''}>
        <ItemGrid items={secItems} active={active} onImageClick={onImageClick} />
      </div>
    </section>
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
  // Which categories are expanded on the "All" view. Empty by default so the page
  // lands short — the dealer opens only the category they want to browse.
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
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

        {active === ALL && (
          <p className="-mt-3 text-xs text-gray-500">Tap a category to see what&apos;s inside.</p>
        )}

        <div className="space-y-3">
          {sections.map((s) => (
            <SectionBlock
              key={s.key}
              sectionKey={s.key}
              name={s.name}
              secItems={s.items}
              active={active}
              open={openKeys.has(s.key)}
              onToggle={toggle}
              onImageClick={openImage}
              visible={sectionVisible(s.key, s.items)}
            />
          ))}
          {other.length > 0 && (
            <SectionBlock
              sectionKey={OTHER}
              name="Other"
              secItems={other}
              active={active}
              open={openKeys.has(OTHER)}
              onToggle={toggle}
              onImageClick={openImage}
              visible={sectionVisible(OTHER, other)}
            />
          )}
        </div>

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
