'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import type * as L from 'leaflet';
import { setStoreLocationAction, autoGeocodeStoreAction, clearStoreLocationAction } from '../../../actions';

type Store = { id: string; number: string; name: string; dealer: string; lat: number | null; lng: number | null };

const DEFAULT_CENTER: [number, number] = [44.39, -79.69]; // Barrie area

function markerHtml(): string {
  return (
    `<div style="position:relative;width:26px;height:26px">` +
    `<div style="width:24px;height:24px;background:#334155;border:2.5px solid #fff;border-radius:7px;` +
    `box-shadow:0 2px 6px rgba(15,29,51,.45);display:flex;align-items:center;justify-content:center">` +
    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 10h16v9H4z" stroke="#fff" stroke-width="2"/>` +
    `<path d="M4 10l1.5-4h13L20 10M9 19v-5h6v5" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg></div></div>`
  );
}

export function StoreLocationEditor({ stores }: { stores: Store[] }) {
  const [rows, setRows] = useState<Store[]>(stores);
  const [selectedId, setSelectedId] = useState<string>(stores[0]?.id ?? '');
  const [draft, setDraft] = useState<{ lat: number; lng: number } | null>(null);
  const [query, setQuery] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const elRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const LRef = useRef<typeof L | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const selected = rows.find((s) => s.id === selectedId) || null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((s) => `${s.number} ${s.name} ${s.dealer}`.toLowerCase().includes(q));
  }, [rows, query]);

  // Init the map + a single draggable marker, once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mod = await import('leaflet');
      const Lmod = ((mod as unknown as { default?: typeof L }).default ?? (mod as unknown as typeof L));
      if (cancelled || !elRef.current || mapRef.current) return;
      LRef.current = Lmod;
      const start = selected?.lat != null && selected?.lng != null ? ([selected.lat, selected.lng] as [number, number]) : DEFAULT_CENTER;
      const map = Lmod.map(elRef.current).setView(start, selected?.lat != null ? 13 : 9);
      Lmod.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
      const marker = Lmod.marker(start, {
        draggable: true,
        icon: Lmod.divIcon({ html: markerHtml(), className: '', iconSize: [26, 26], iconAnchor: [13, 13] }),
      }).addTo(map);
      marker.on('dragend', () => {
        const p = marker.getLatLng();
        setDraft({ lat: p.lat, lng: p.lng });
      });
      map.on('click', (e: L.LeafletMouseEvent) => {
        marker.setLatLng(e.latlng);
        setDraft({ lat: e.latlng.lat, lng: e.latlng.lng });
      });
      markerRef.current = marker;
      mapRef.current = map;
      if (selected?.lat != null && selected?.lng != null) setDraft({ lat: selected.lat, lng: selected.lng });
      setTimeout(() => map.invalidateSize(), 0);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the selected store changes, move the marker/map to it.
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker || !selected) return;
    setMsg(null);
    if (selected.lat != null && selected.lng != null) {
      const ll: [number, number] = [selected.lat, selected.lng];
      marker.setLatLng(ll);
      map.setView(ll, 14);
      setDraft({ lat: selected.lat, lng: selected.lng });
    } else {
      // Unplaced — keep the marker at the current center so it can be dropped.
      const c = map.getCenter();
      marker.setLatLng(c);
      setDraft({ lat: c.lat, lng: c.lng });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Keep the marker in sync when coords are typed by hand.
  function applyManual(lat: number, lng: number) {
    setDraft({ lat, lng });
    const map = mapRef.current;
    const marker = markerRef.current;
    if (map && marker && Number.isFinite(lat) && Number.isFinite(lng)) {
      marker.setLatLng([lat, lng]);
      map.panTo([lat, lng]);
    }
  }

  function save() {
    if (!selected || !draft) return;
    startTransition(async () => {
      const r = await setStoreLocationAction(selected.id, draft.lat, draft.lng);
      if (r.ok) {
        setRows((prev) => prev.map((s) => (s.id === selected.id ? { ...s, lat: draft.lat, lng: draft.lng } : s)));
        setMsg({ ok: true, text: 'Saved.' });
      } else setMsg({ ok: false, text: r.error || 'Could not save.' });
    });
  }
  function autoPlace() {
    if (!selected) return;
    startTransition(async () => {
      const r = await autoGeocodeStoreAction(selected.id);
      if (r.ok && r.lat != null && r.lng != null) {
        setRows((prev) => prev.map((s) => (s.id === selected.id ? { ...s, lat: r.lat!, lng: r.lng! } : s)));
        applyManual(r.lat, r.lng);
        mapRef.current?.setView([r.lat, r.lng], 14);
        setMsg({ ok: true, text: 'Placed from the store name.' });
      } else setMsg({ ok: false, text: r.error || 'Could not auto-place.' });
    });
  }
  function clearLoc() {
    if (!selected) return;
    startTransition(async () => {
      const r = await clearStoreLocationAction(selected.id);
      if (r.ok) {
        setRows((prev) => prev.map((s) => (s.id === selected.id ? { ...s, lat: null, lng: null } : s)));
        setMsg({ ok: true, text: 'Cleared — this store is off the map until re-placed.' });
      } else setMsg({ ok: false, text: r.error || 'Could not clear.' });
    });
  }

  const placedCount = rows.filter((s) => s.lat != null && s.lng != null).length;

  return (
    <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      {/* Store list */}
      <div className="card flex max-h-[560px] flex-col overflow-hidden p-0">
        <div className="border-b border-gray-100 p-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search store, dealer…"
            className="input w-full text-sm"
          />
          <div className="mt-2 text-xs text-gray-400">{placedCount} of {rows.length} placed</div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">No stores match.</div>
          ) : (
            filtered.map((s) => {
              const on = s.id === selectedId;
              const placed = s.lat != null && s.lng != null;
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  className={`flex w-full items-center gap-3 border-b border-gray-100 px-3 py-2.5 text-left transition ${on ? 'bg-brand-50' : 'hover:bg-gray-50'}`}
                >
                  <span className={`h-2.5 w-2.5 flex-none rounded-full ${placed ? 'bg-emerald-500' : 'bg-gray-300'}`} title={placed ? 'Placed' : 'Not placed'} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-gray-900">#{s.number}{s.name ? ` — ${s.name}` : ''}</span>
                    <span className="block truncate text-xs text-gray-500">{s.dealer || '—'}</span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Map + controls */}
      <div className="space-y-3">
        <div className="overflow-hidden rounded-2xl border border-gray-200 shadow-sm" style={{ height: 420 }}>
          <div ref={elRef} style={{ height: '100%', width: '100%' }} aria-label="Store location map" />
        </div>

        {selected ? (
          <div className="card space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-gray-900">
                #{selected.number}{selected.name ? ` — ${selected.name}` : ''}
                <span className="ml-2 text-xs font-normal text-gray-500">{selected.dealer}</span>
              </div>
              {selected.lat != null ? (
                <span className="badge bg-emerald-100 text-emerald-800">On the map</span>
              ) : (
                <span className="badge bg-gray-100 text-gray-600">Not placed</span>
              )}
            </div>

            <p className="text-xs text-gray-500">Drag the marker or tap the map to set the exact spot, or paste coordinates from Google Maps (right-click a point → the lat, lng at the top).</p>

            <div className="flex flex-wrap items-end gap-3">
              <label className="text-xs font-medium text-gray-600">
                Latitude
                <input
                  type="number"
                  step="any"
                  value={draft?.lat ?? ''}
                  onChange={(e) => applyManual(parseFloat(e.target.value), draft?.lng ?? DEFAULT_CENTER[1])}
                  className="input mt-1 w-36 text-sm tabular-nums"
                />
              </label>
              <label className="text-xs font-medium text-gray-600">
                Longitude
                <input
                  type="number"
                  step="any"
                  value={draft?.lng ?? ''}
                  onChange={(e) => applyManual(draft?.lat ?? DEFAULT_CENTER[0], parseFloat(e.target.value))}
                  className="input mt-1 w-36 text-sm tabular-nums"
                />
              </label>
            </div>

            {msg && (
              <div className={`text-xs ${msg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{msg.text}</div>
            )}

            <div className="flex flex-wrap gap-2">
              <button onClick={save} disabled={pending || !draft} className="btn-primary text-sm">
                {pending ? 'Saving…' : 'Save location'}
              </button>
              <button onClick={autoPlace} disabled={pending} className="btn-secondary text-sm">Auto-place from name</button>
              {selected.lat != null && (
                <button onClick={clearLoc} disabled={pending} className="btn-secondary text-sm text-red-600">Clear</button>
              )}
            </div>
          </div>
        ) : (
          <div className="card p-4 text-sm text-gray-500">Pick a store from the list to set its location.</div>
        )}
      </div>
    </div>
  );
}
