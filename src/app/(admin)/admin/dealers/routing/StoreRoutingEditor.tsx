'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { reassignStoreAction, addStoreMappingAction, setStoreActiveAction } from '../../../actions';

interface Dealer { id: string; name: string }
interface Store { id: string; number: string; city: string; active: boolean; dealerId: string; dealerName: string }

const NEW_DEALER = '__new__';

/** Dealer picker that reveals a text box when "New office…" is chosen. */
function DealerPicker({
  dealers,
  value,
  newName,
  onValue,
  onNewName,
  exclude,
}: {
  dealers: Dealer[];
  value: string;
  newName: string;
  onValue: (v: string) => void;
  onNewName: (v: string) => void;
  exclude?: string;
}) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <select
        value={value}
        onChange={(e) => onValue(e.target.value)}
        className="rounded border border-gray-300 px-2 py-1 text-sm"
      >
        <option value="">Select office…</option>
        {dealers.filter((d) => d.id !== exclude).map((d) => (
          <option key={d.id} value={d.id}>{d.name}</option>
        ))}
        <option value={NEW_DEALER}>＋ New office…</option>
      </select>
      {value === NEW_DEALER && (
        <input
          type="text"
          value={newName}
          onChange={(e) => onNewName(e.target.value)}
          placeholder="New office name (e.g. Swift)"
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        />
      )}
    </span>
  );
}

export function StoreRoutingEditor({ dealers, stores }: { dealers: Dealer[]; stores: Store[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [query, setQuery] = useState('');

  // Per-row "move to" picker state, keyed by store id.
  const [pick, setPick] = useState<Record<string, { dealerId: string; newName: string }>>({});
  // "Add a store" form state.
  const [addOpen, setAddOpen] = useState(false);
  const [addNumber, setAddNumber] = useState('');
  const [addCity, setAddCity] = useState('');
  const [addDealer, setAddDealer] = useState('');
  const [addNewName, setAddNewName] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stores;
    return stores.filter((s) => `${s.number} ${s.city} ${s.dealerName}`.toLowerCase().includes(q));
  }, [stores, query]);

  // Group filtered stores by their current dealer (alphabetical).
  const groups = useMemo(() => {
    const by = new Map<string, Store[]>();
    for (const s of filtered) {
      const arr = by.get(s.dealerName);
      if (arr) arr.push(s);
      else by.set(s.dealerName, [s]);
    }
    return Array.from(by.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  function run(fn: () => Promise<{ ok?: boolean; error?: string; message?: string }>) {
    setMsg(null);
    startTransition(async () => {
      const res = await fn();
      if (res.error) setMsg({ ok: false, text: res.error });
      else setMsg({ ok: true, text: res.message || 'Saved.' });
      if (!res.error) router.refresh();
    });
  }

  function move(store: Store) {
    const p = pick[store.id] ?? { dealerId: '', newName: '' };
    const isNew = p.dealerId === NEW_DEALER;
    if (!p.dealerId) { setMsg({ ok: false, text: 'Choose an office to move the store to.' }); return; }
    run(() => reassignStoreAction(store.id, isNew ? null : p.dealerId, isNew ? p.newName : null));
    setPick((prev) => ({ ...prev, [store.id]: { dealerId: '', newName: '' } }));
  }

  function add() {
    const isNew = addDealer === NEW_DEALER;
    run(() => addStoreMappingAction(addNumber, addCity, isNew ? null : addDealer, isNew ? addNewName : null));
    setAddNumber(''); setAddCity(''); setAddDealer(''); setAddNewName('');
  }

  return (
    <div className="space-y-5">
      {msg && (
        <div className={`rounded-lg border p-3 text-sm ${msg.ok ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
          {msg.text}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by store #, city, or office…"
          className="w-64 rounded border border-gray-300 px-3 py-1.5 text-sm"
        />
        <button type="button" onClick={() => setAddOpen((o) => !o)} className="btn-secondary text-sm">
          {addOpen ? 'Cancel' : '＋ Add a store'}
        </button>
      </div>

      {addOpen && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="mb-3 text-sm font-medium text-gray-800">Add a store → office routing</div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-gray-600">Store #
              <input type="text" value={addNumber} onChange={(e) => setAddNumber(e.target.value)} placeholder="7030" className="mt-1 block w-24 rounded border border-gray-300 px-2 py-1 text-sm" />
            </label>
            <label className="text-xs text-gray-600">City / name
              <input type="text" value={addCity} onChange={(e) => setAddCity(e.target.value)} placeholder="Newmarket" className="mt-1 block w-40 rounded border border-gray-300 px-2 py-1 text-sm" />
            </label>
            <label className="text-xs text-gray-600">Routes to
              <span className="mt-1 block"><DealerPicker dealers={dealers} value={addDealer} newName={addNewName} onValue={setAddDealer} onNewName={setAddNewName} /></span>
            </label>
            <button type="button" onClick={add} disabled={pending} className="btn-primary text-sm disabled:opacity-60">Add</button>
          </div>
        </div>
      )}

      {groups.map(([dealerName, rows]) => (
        <section key={dealerName} className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/60 px-4 py-2.5">
            <span className="text-sm font-semibold text-gray-900">{dealerName}</span>
            <span className="text-xs text-gray-500">{rows.length} store{rows.length === 1 ? '' : 's'}</span>
          </div>
          <ul className="divide-y divide-gray-100">
            {rows.map((s) => {
              const p = pick[s.id] ?? { dealerId: '', newName: '' };
              return (
                <li key={s.id} className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${s.active ? '' : 'opacity-60'}`}>
                  <span className="min-w-0">
                    <span className="font-mono text-sm font-medium text-gray-900">{s.number}</span>
                    <span className="ml-2 text-sm text-gray-600">{s.city || '—'}</span>
                    {!s.active && <span className="ml-2 rounded bg-gray-200 px-1.5 text-xs text-gray-600">inactive</span>}
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-gray-400">move to</span>
                    <DealerPicker
                      dealers={dealers}
                      value={p.dealerId}
                      newName={p.newName}
                      exclude={s.dealerId}
                      onValue={(v) => setPick((prev) => ({ ...prev, [s.id]: { ...p, dealerId: v } }))}
                      onNewName={(v) => setPick((prev) => ({ ...prev, [s.id]: { ...p, newName: v } }))}
                    />
                    <button type="button" onClick={() => move(s)} disabled={pending} className="btn-primary text-xs disabled:opacity-60">Move</button>
                    <button
                      type="button"
                      onClick={() => run(() => setStoreActiveAction(s.id, !s.active))}
                      disabled={pending}
                      className="btn-secondary text-xs disabled:opacity-60"
                    >
                      {s.active ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {groups.length === 0 && <p className="py-8 text-center text-sm text-gray-500">No stores match “{query}”.</p>}
    </div>
  );
}
