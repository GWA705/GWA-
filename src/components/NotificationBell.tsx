'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Item {
  id: string;
  title: string;
  body: string | null;
  url: string | null;
  category: string | null;
  applicationId: string | null;
  customerName: string | null;
  read: boolean;
  createdAtISO: string;
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** Group items by customer (applicationId, else customerName, else "Other"). */
function groupByCustomer(items: Item[]): { key: string; label: string; items: Item[] }[] {
  const groups = new Map<string, { key: string; label: string; items: Item[] }>();
  for (const it of items) {
    const key = it.applicationId || it.customerName || '__other__';
    const label = it.customerName || (it.applicationId ? 'A deal' : 'Other updates');
    const g = groups.get(key);
    if (g) g.items.push(it);
    else groups.set(key, { key, label, items: [it] });
  }
  return Array.from(groups.values());
}

export function NotificationBell({ allHref }: { allHref: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<Item[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/notifications', { cache: 'no-store' });
      if (r.ok) {
        const data = await r.json();
        setUnread(data.unread ?? 0);
        setItems(data.items ?? []);
      }
    } catch {
      /* offline — keep last */
    }
  }, []);

  // Poll: briskly while open, quietly while closed.
  useEffect(() => {
    load();
    const t = setInterval(load, open ? 15000 : 60000);
    return () => clearInterval(t);
  }, [open, load]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  async function markRead(id: string) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, read: true } : i)));
    setUnread((u) => Math.max(0, u - 1));
    try { await fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); } catch { /* ignore */ }
  }

  async function markAll() {
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    setUnread(0);
    try { await fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ all: true }) }); } catch { /* ignore */ }
  }

  function openItem(it: Item) {
    if (!it.read) void markRead(it.id);
    setOpen(false);
    if (it.url) router.push(it.url);
  }

  const groups = groupByCustomer(items);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={unread > 0 ? `Notifications (${unread} unread)` : 'Notifications'}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 flex max-h-[32rem] w-[22rem] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
            <span className="text-sm font-semibold text-gray-900">Notifications</span>
            {unread > 0 && (
              <button type="button" onClick={markAll} className="text-xs font-medium text-brand-700 hover:underline">Mark all read</button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {groups.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-gray-400">You’re all caught up.</p>
            ) : (
              groups.map((g) => (
                <div key={g.key} className="border-b border-gray-50 last:border-0">
                  <div className="bg-gray-50/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">{g.label}</div>
                  <ul>
                    {g.items.map((it) => (
                      <li key={it.id}>
                        <button
                          type="button"
                          onClick={() => openItem(it)}
                          className={`flex w-full flex-col items-start gap-0.5 px-4 py-2.5 text-left hover:bg-gray-50 ${it.read ? '' : 'bg-brand-50/40'}`}
                        >
                          <span className="flex w-full items-center gap-2">
                            {!it.read && <span className="h-2 w-2 flex-none rounded-full bg-brand-500" aria-hidden />}
                            <span className={`text-sm ${it.read ? 'font-medium text-gray-700' : 'font-semibold text-gray-900'}`}>{it.title}</span>
                          </span>
                          {it.body && <span className="pl-4 text-xs text-gray-500">{it.body}</span>}
                          <span className="pl-4 text-[11px] text-gray-400">{fmt(it.createdAtISO)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>

          <Link href={allHref} onClick={() => setOpen(false)} className="border-t border-gray-100 px-4 py-2.5 text-center text-sm font-medium text-brand-700 hover:bg-gray-50">
            See all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
