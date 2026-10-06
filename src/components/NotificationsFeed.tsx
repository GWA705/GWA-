'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

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

/** Full-page notifications list — grouped by customer, newest first, with read state. */
export function NotificationsFeed() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/notifications', { cache: 'no-store' });
      if (r.ok) { const data = await r.json(); setItems(data.items ?? []); }
    } catch { /* keep last */ } finally { setLoaded(true); }
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, [load]);

  async function markRead(id: string) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, read: true } : i)));
    try { await fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); } catch { /* ignore */ }
  }
  async function markAll() {
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    try { await fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ all: true }) }); } catch { /* ignore */ }
  }
  function openItem(it: Item) {
    if (!it.read) void markRead(it.id);
    if (it.url) router.push(it.url);
  }

  const groups = groupByCustomer(items);
  const anyUnread = items.some((i) => !i.read);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Everything you’ve been alerted about, grouped by customer. Newest first.</p>
        {anyUnread && <button type="button" onClick={markAll} className="btn-secondary text-sm">Mark all read</button>}
      </div>

      {!loaded ? (
        <p className="py-10 text-center text-sm text-gray-400">Loading…</p>
      ) : groups.length === 0 ? (
        <p className="py-16 text-center text-sm text-gray-400">You’re all caught up — no notifications.</p>
      ) : (
        groups.map((g) => (
          <section key={g.key} className="card overflow-hidden">
            <div className="border-b border-gray-100 bg-gray-50/70 px-4 py-2 text-sm font-semibold text-gray-900">{g.label}</div>
            <ul className="divide-y divide-gray-50">
              {g.items.map((it) => (
                <li key={it.id}>
                  <button type="button" onClick={() => openItem(it)} className={`flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left hover:bg-gray-50 ${it.read ? '' : 'bg-brand-50/40'}`}>
                    <span className="flex w-full items-center gap-2">
                      {!it.read && <span className="h-2 w-2 flex-none rounded-full bg-brand-500" aria-hidden />}
                      <span className={`text-sm ${it.read ? 'font-medium text-gray-700' : 'font-semibold text-gray-900'}`}>{it.title}</span>
                      <span className="ml-auto text-[11px] text-gray-400">{fmt(it.createdAtISO)}</span>
                    </span>
                    {it.body && <span className="pl-4 text-xs text-gray-500">{it.body}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
