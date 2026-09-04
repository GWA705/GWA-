'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import {
  ShoppingCart, Search, LifeBuoy, ArrowRight, Truck, BadgeCheck, HelpCircle,
  Shirt, Presentation, Package, Sparkles, LayoutGrid, MoreHorizontal, type LucideIcon,
} from 'lucide-react';
import { createOrderAction, type OrderActionState } from './actions';
import { MARKETPLACE_TAGS } from '@/lib/constants';

interface Item {
  id: string;
  name: string;
  description: string | null;
  options: string[];
  hasImage: boolean;
  imageVersion?: number;
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

// A single line in the cart: an item, a chosen option (size), and a quantity.
// Multiple sizes of the same item are separate lines (e.g. 3×S and 3×L).
interface CartLine {
  itemId: string;
  itemName: string;
  option: string | null;
  qty: number;
}

const initial: OrderActionState = {};
const NEW_ARRIVALS = '__new__';
const ALL = '__all__';
const OTHER = '__other__';

const lineKey = (itemId: string, option: string | null) => `${itemId}::${option ?? ''}`;

/** Best-effort icon for a marketplace category, by name. */
function categoryIcon(label: string): LucideIcon {
  const l = label.toLowerCase();
  if (l.includes('apparel') || l.includes('cloth') || l.includes('wear')) return Shirt;
  if (l.includes('sign')) return Presentation;
  if (l.includes('sample') || l.includes('kit')) return Package;
  if (l.includes('new')) return Sparkles;
  if (l.includes('other')) return MoreHorizontal;
  return LayoutGrid;
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
  const imgSrc = `/api/marketplace/items/${item.id}/image?v=${item.imageVersion ?? 0}`;
  return item.hasImage ? (
    <button
      type="button"
      onClick={() => onImageClick(`${imgSrc}&size=full`, item.name)}
      className={`photo-mat relative block aspect-square w-full cursor-zoom-in border-b border-gray-200 ${className ?? ''}`}
      aria-label={`View ${item.name} larger`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imgSrc} alt={item.name} loading="lazy" className="h-full w-full object-contain p-3" />
      <TagBadges tags={item.tags} />
    </button>
  ) : (
    <div className={`photo-mat relative flex aspect-square w-full items-center justify-center border-b border-gray-200 text-4xl text-gray-300 ${className ?? ''}`} aria-hidden>
      👕
      <TagBadges tags={item.tags} />
    </div>
  );
}

// Order controls for one product: pick a size/option and quantity, then Add to
// cart. Adding the same item in a different size creates a separate cart line.
function OrderControls({ item, onAdd }: { item: Item; onAdd: (item: Item, option: string | null, qty: number) => void }) {
  const [option, setOption] = useState(item.options[0] ?? '');
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  function add() {
    const q = Math.max(1, qty);
    onAdd(item, item.options.length > 0 ? option : null, q);
    setQty(1);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1300);
  }

  return (
    <div className="mt-auto space-y-2 pt-4">
      <div className="flex items-end gap-2">
        {item.options.length > 0 && (
          <div className="flex-1">
            <label className="label" htmlFor={`opt_${item.id}`}>Size / option</label>
            <select id={`opt_${item.id}`} value={option} onChange={(e) => setOption(e.target.value)} className="input">
              {item.options.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
        )}
        <div className="w-20">
          <label className="label" htmlFor={`qty_${item.id}`}>Qty</label>
          <input
            id={`qty_${item.id}`}
            type="number"
            min="1"
            value={qty}
            onChange={(e) => setQty(Math.max(1, Number.parseInt(e.target.value || '1', 10) || 1))}
            className="input"
          />
        </div>
      </div>
      <button
        type="button"
        onClick={add}
        className={`flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
          added ? 'bg-green-600 text-white' : 'bg-brand-600 text-white hover:bg-brand-700'
        }`}
      >
        {added ? '✓ Added to cart' : <><ShoppingCart size={15} /> Add to cart</>}
      </button>
    </div>
  );
}

function ItemCard({
  item,
  onImageClick,
  onAdd,
}: {
  item: Item;
  onImageClick: (src: string, alt: string) => void;
  onAdd: (item: Item, option: string | null, qty: number) => void;
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      <ItemImage item={item} onImageClick={onImageClick} />
      <div className="flex flex-1 flex-col p-4">
        <div className="font-semibold text-gray-900">{item.name}</div>
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
          <OrderControls item={item} onAdd={onAdd} />
        )}
      </div>
    </div>
  );
}

function NewArrivalsRail({ items, onImageClick }: { items: Item[]; onImageClick: (src: string, alt: string) => void }) {
  const scroller = useRef<HTMLDivElement>(null);
  const paused = useRef(false);

  function nudge(dir: 1 | -1) {
    const el = scroller.current;
    if (!el) return;
    const step = Math.max(200, Math.round(el.clientWidth * 0.8));
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
    <section className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900"><Sparkles size={18} className="text-blue-600" /> New Arrivals</h2>
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

// Big category cards (mockup style): icon, name, item count.
function CategoryCards({
  chips,
  active,
  onSelect,
}: {
  chips: { key: string; label: string; count: number }[];
  active: string;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {chips.map((c) => {
        const on = c.key === active;
        const Icon = c.key === ALL ? LayoutGrid : c.key === NEW_ARRIVALS ? Sparkles : c.key === OTHER ? MoreHorizontal : categoryIcon(c.label);
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => onSelect(c.key)}
            aria-pressed={on}
            className={`flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition ${
              on ? 'border-blue-500 bg-blue-50 shadow-sm ring-1 ring-blue-200' : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
          >
            <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-lg ${on ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600'}`}>
              <Icon size={18} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-[#0d2a63]">{c.label.replace(/^✨\s*/, '')}</span>
              <span className="block text-xs text-slate-500">{c.count} item{c.count === 1 ? '' : 's'}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ItemGrid({
  items,
  onImageClick,
  onAdd,
}: {
  items: Item[];
  onImageClick: (src: string, alt: string) => void;
  onAdd: (item: Item, option: string | null, qty: number) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <ItemCard key={item.id} item={item} onImageClick={onImageClick} onAdd={onAdd} />
      ))}
    </div>
  );
}

// Shared cart body: the line list + note + submit form. Used by both the
// desktop rail and the mobile drawer, so they stay in sync.
function CartContents({
  lines,
  onQty,
  onRemove,
  action,
  error,
  listClass,
}: {
  lines: CartLine[];
  onQty: (key: string, qty: number) => void;
  onRemove: (key: string) => void;
  action: (formData: FormData) => void;
  error?: string;
  listClass?: string;
}) {
  const cartJson = JSON.stringify(lines.map((l) => ({ itemId: l.itemId, option: l.option, quantity: l.qty })));
  return (
    <>
      <div className={`min-h-0 overflow-y-auto ${listClass ?? ''}`}>
        {lines.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-gray-500">
            Your cart is empty. Add items — including several sizes of one product — then submit together.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {lines.map((l) => (
              <li key={lineKey(l.itemId, l.option)} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-gray-900">{l.itemName}</div>
                  {l.option && <div className="text-xs text-gray-500">{l.option}</div>}
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => onQty(lineKey(l.itemId, l.option), l.qty - 1)} aria-label="Decrease" className="h-7 w-7 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50">−</button>
                  <input
                    type="number"
                    min="1"
                    value={l.qty}
                    onChange={(e) => onQty(lineKey(l.itemId, l.option), Math.max(1, Number.parseInt(e.target.value || '1', 10) || 1))}
                    className="w-12 rounded-md border border-gray-200 py-1 text-center text-sm tabular-nums"
                    aria-label={`Quantity of ${l.itemName}${l.option ? ` ${l.option}` : ''}`}
                  />
                  <button type="button" onClick={() => onQty(lineKey(l.itemId, l.option), l.qty + 1)} aria-label="Increase" className="h-7 w-7 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50">+</button>
                </div>
                <button type="button" onClick={() => onRemove(lineKey(l.itemId, l.option))} aria-label={`Remove ${l.itemName}`} className="ml-1 text-gray-400 hover:text-red-600">✕</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form action={action} className="mt-3 border-t border-gray-200 pt-3">
        <input type="hidden" name="cart" value={cartJson} />
        {error && <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-2.5 text-sm text-red-800" role="alert">{error}</div>}
        <label className="label" htmlFor="note">Note <span className="font-normal text-gray-400">(optional)</span></label>
        <textarea id="note" name="note" rows={2} className="input mb-3" placeholder="Anything the fulfillment team should know…" />
        <SubmitButton disabled={lines.length === 0} />
        <p className="mt-2 text-center text-[11px] text-gray-400">No payment now — we&apos;ll confirm and fulfill your order.</p>
      </form>
    </>
  );
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary flex w-full items-center justify-center gap-2" disabled={pending || disabled}>
      {pending ? 'Submitting…' : <>Submit order <ArrowRight size={16} /></>}
    </button>
  );
}

/** Support card in the rail — opens the corner chat (ChatWidget listens). */
function SupportRailCard() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#0e2b5c] p-5 text-white shadow-sm">
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-[42%] bg-cover bg-no-repeat"
        style={{ backgroundImage: "url('/support-agent.png')", backgroundPosition: '68% 22%' }}
        aria-hidden
      />
      <LifeBuoy className="pointer-events-none absolute -right-3 bottom-2 text-white/5" size={120} aria-hidden />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0e2b5c] via-[#0e2b5c]/85 to-transparent" aria-hidden />
      <div className="relative z-10 max-w-[62%]">
        <div className="text-lg font-bold">Need help with your order?</div>
        <p className="mt-1 text-sm text-blue-100">Our support team is here to help.</p>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('gwa:open-chat', { detail: { support: true } }))}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#0e2b5c] transition hover:bg-blue-50"
        >
          Contact Support <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

const INFO_TILES: { Icon: LucideIcon; title: string; body: string }[] = [
  { Icon: Truck, title: 'Fast processing', body: 'Orders are picked up by our team promptly.' },
  { Icon: BadgeCheck, title: 'Dealer exclusive', body: 'Branded products for your success.' },
  { Icon: HelpCircle, title: 'Questions?', body: 'Contact your dealer support team.' },
];

function InfoTiles() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <ul className="space-y-3">
        {INFO_TILES.map((t) => (
          <li key={t.title} className="flex items-start gap-3">
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-blue-50 text-blue-600"><t.Icon size={18} /></span>
            <div className="leading-tight">
              <div className="text-sm font-bold text-[#0d2a63]">{t.title}</div>
              <div className="text-xs text-slate-500">{t.body}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Slide-over cart for mobile (the desktop rail shows the cart inline).
function CartDrawer({
  open, onClose, lines, onQty, onRemove, action, error,
}: {
  open: boolean;
  onClose: () => void;
  lines: CartLine[];
  onQty: (key: string, qty: number) => void;
  onRemove: (key: string) => void;
  action: (formData: FormData) => void;
  error?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  const totalUnits = lines.reduce((s, l) => s + l.qty, 0);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose} role="dialog" aria-modal="true" aria-label="Your order">
      <aside className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="text-base font-semibold text-gray-900">Your order {lines.length > 0 && <span className="text-gray-400">· {totalUnits} item{totalUnits === 1 ? '' : 's'}</span>}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100">✕</button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col px-4 py-3">
          <CartContents lines={lines} onQty={onQty} onRemove={onRemove} action={action} error={error} listClass="flex-1" />
        </div>
      </aside>
    </div>
  );
}

export function MarketplaceOrderForm({ items, categories }: { items: Item[]; categories: Category[] }) {
  const [state, action] = useFormState(createOrderAction, initial);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
  const [active, setActive] = useState<string>(ALL);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<'featured' | 'name'>('featured');

  // On a successful submit the action returns { ok: true } — clear + confirm.
  useEffect(() => {
    if (state?.ok) {
      setCart([]);
      setCartOpen(false);
      setSubmitted(true);
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [state]);

  const openImage = (src: string, alt: string) => setLightbox({ src, alt });

  // Add to cart — same item + option increments that line; a different size is a
  // new line, so 3×S and 3×L of one shirt sit side by side.
  function addToCart(item: Item, option: string | null, qty: number) {
    setSubmitted(false);
    setCart((prev) => {
      const key = lineKey(item.id, option);
      const existing = prev.find((l) => lineKey(l.itemId, l.option) === key);
      if (existing) {
        return prev.map((l) => (lineKey(l.itemId, l.option) === key ? { ...l, qty: Math.min(9999, l.qty + qty) } : l));
      }
      return [...prev, { itemId: item.id, itemName: item.name, option, qty: Math.min(9999, qty) }];
    });
  }
  function setQty(key: string, qty: number) {
    if (qty < 1) { setCart((prev) => prev.filter((l) => lineKey(l.itemId, l.option) !== key)); return; }
    setCart((prev) => prev.map((l) => (lineKey(l.itemId, l.option) === key ? { ...l, qty: Math.min(9999, qty) } : l)));
  }
  function remove(key: string) {
    setCart((prev) => prev.filter((l) => lineKey(l.itemId, l.option) !== key));
  }

  const totalUnits = cart.reduce((s, l) => s + l.qty, 0);

  const activeIds = new Set(categories.map((c) => c.id));
  const featured = items.filter((it) => it.featured);
  const sections = categories
    .map((c) => ({ key: c.id, name: c.name, items: items.filter((it) => it.categoryId === c.id) }))
    .filter((s) => s.items.length > 0);
  const other = items.filter((it) => !it.categoryId || !activeIds.has(it.categoryId));

  const chips = [
    { key: ALL, label: 'All', count: items.length },
    ...(featured.length > 0 ? [{ key: NEW_ARRIVALS, label: '✨ New Arrivals', count: featured.length }] : []),
    ...sections.map((s) => ({ key: s.key, label: s.name, count: s.items.length })),
    ...(other.length > 0 ? [{ key: OTHER, label: 'Other', count: other.length }] : []),
  ];

  // Which items are visible given the active category, search and sort.
  const visibleItems = useMemo(() => {
    let list: Item[];
    if (active === ALL) list = items;
    else if (active === NEW_ARRIVALS) list = featured;
    else if (active === OTHER) list = other;
    else list = items.filter((it) => it.categoryId === active);

    const q = query.trim().toLowerCase();
    if (q) list = list.filter((it) => it.name.toLowerCase().includes(q) || (it.description ?? '').toLowerCase().includes(q));

    const sorted = [...list];
    if (sortBy === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name));
    else sorted.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
    return sorted;
  }, [items, featured, other, active, query, sortBy]);

  const activeLabel = chips.find((c) => c.key === active)?.label.replace(/^✨\s*/, '') ?? 'All';

  return (
    <>
      {submitted && (
        <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          ✓ Your order was submitted. Thanks — we&apos;ll be in touch.
        </div>
      )}

      <CategoryCards chips={chips} active={active} onSelect={setActive} />

      {/* Search + sort */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
          <Search size={17} className="text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products…"
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="mp-sort" className="text-xs font-semibold text-slate-500">Sort by</label>
          <select
            id="mp-sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'featured' | 'name')}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none"
          >
            <option value="featured">Featured first</option>
            <option value="name">Name (A–Z)</option>
          </select>
        </div>
      </div>

      {featured.length > 0 && !query.trim() && (active === ALL || active === NEW_ARRIVALS) && (
        <NewArrivalsRail items={featured} onImageClick={openImage} />
      )}

      {/* Products + rail */}
      <div className="grid grid-cols-1 gap-5 pb-24 xl:grid-cols-[1fr_320px] xl:pb-5">
        <div className="min-w-0 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{query.trim() ? 'Search results' : activeLabel}</h2>
            <span className="text-xs text-gray-400">{visibleItems.length} item{visibleItems.length === 1 ? '' : 's'}</span>
          </div>
          {visibleItems.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-gray-500">
              No products match{query.trim() ? ` “${query.trim()}”` : ' this category'}.
            </div>
          ) : (
            <ItemGrid items={visibleItems} onImageClick={openImage} onAdd={addToCart} />
          )}
        </div>

        {/* Desktop rail */}
        <aside className="hidden xl:block">
          <div className="sticky top-4 space-y-4">
            <section className="flex max-h-[70vh] flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-base font-bold text-[#0d2a63]">
                  <ShoppingCart size={18} className="text-blue-600" /> Your cart
                  {totalUnits > 0 && <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-bold text-white">{totalUnits}</span>}
                </h3>
                {cart.length > 0 && (
                  <button type="button" onClick={() => setCart([])} className="text-xs font-semibold text-slate-400 hover:text-red-600">Clear all</button>
                )}
              </div>
              <CartContents lines={cart} onQty={setQty} onRemove={remove} action={action} error={state.error} listClass="max-h-[38vh]" />
            </section>
            <SupportRailCard />
            <InfoTiles />
          </div>
        </aside>
      </div>

      {/* Floating cart button (mobile only — desktop uses the rail) */}
      <button
        type="button"
        onClick={() => setCartOpen(true)}
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-brand-700 xl:hidden"
      >
        <ShoppingCart size={16} /> Cart
        {totalUnits > 0 && (
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-white px-1.5 text-xs font-bold text-brand-700 tabular-nums">{totalUnits}</span>
        )}
      </button>

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        lines={cart}
        onQty={setQty}
        onRemove={remove}
        action={action}
        error={state.error}
      />

      {lightbox && <Lightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />}
    </>
  );
}
