'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import type * as L from 'leaflet';

export type LatLng = { lat: number; lng: number };
export type MapLead = {
  key: string;
  query: string;
  rowId: string;
  name: string;
  status: 'new' | 'working' | 'booked' | 'nogood';
  statusLabel: string;
  sub: string;
  dist?: string;
  openHref: string;
  coord?: LatLng | null;
};
export type MapStore = { number: string; name: string; lat: number; lng: number };

const COLOR: Record<MapLead['status'], string> = {
  new: '#2563eb',
  working: '#d97706',
  booked: '#059669',
  nogood: '#dc2626',
};
const STORE_COLOR = '#334155';

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

// A teardrop pin as an HTML divIcon (no external marker images needed).
function pinHtml(color: string): string {
  return (
    `<div style="position:relative;width:24px;height:24px">` +
    `<div style="width:22px;height:22px;background:${color};border:2.5px solid #fff;border-radius:50% 50% 50% 0;` +
    `transform:rotate(45deg);box-shadow:0 2px 6px rgba(15,29,51,.4)"></div>` +
    `<div style="position:absolute;top:7px;left:7px;width:8px;height:8px;background:#fff;border-radius:50%"></div>` +
    `</div>`
  );
}
function storeHtml(): string {
  return (
    `<div style="width:24px;height:24px;background:${STORE_COLOR};border:2.5px solid #fff;border-radius:7px;` +
    `box-shadow:0 2px 6px rgba(15,29,51,.4);display:flex;align-items:center;justify-content:center">` +
    `<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M4 10h16v9H4z" stroke="#fff" stroke-width="2"/>` +
    `<path d="M4 10l1.5-4h13L20 10M9 19v-5h6v5" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg></div>`
  );
}

function popupHtml(l: MapLead): string {
  return (
    `<div style="font-family:inherit;min-width:180px">` +
    `<div style="font-weight:800;font-size:14px;color:#0f1b2d">${esc(l.name || '(no name)')}</div>` +
    `<div style="display:inline-block;margin:5px 0;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;` +
    `color:#fff;background:${COLOR[l.status]}">${esc(l.statusLabel)}</div>` +
    `<div style="font-size:12px;color:#5c6b80">${esc(l.sub)}${l.dist ? ` · ${esc(l.dist)}` : ''}</div>` +
    `<a href="${esc(l.openHref)}" style="display:block;margin-top:9px;text-align:center;background:#2563eb;color:#fff;` +
    `font-weight:700;font-size:12.5px;padding:7px;border-radius:8px;text-decoration:none">Open lead →</a>` +
    `</div>`
  );
}

/**
 * Leaflet + OpenStreetMap map of leads and the office's Home Depot stores.
 * Leads with cached coordinates draw immediately; any without are geocoded
 * progressively via /api/leads/geocode and dropped in as they resolve.
 */
export function LeadsMap({ leads, stores }: { leads: MapLead[]; stores: MapStore[] }) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const LRef = useRef<typeof L | null>(null);
  const leadLayerRef = useRef<L.LayerGroup | null>(null);
  const didFitRef = useRef(false);

  // key → coord (null = tried, no result). Seeded from the server's cache.
  const [coords, setCoords] = useState<Record<string, LatLng | null>>(() => {
    const seed: Record<string, LatLng | null> = {};
    for (const l of leads) if (l.coord !== undefined) seed[l.key] = l.coord;
    return seed;
  });
  const [pending, setPending] = useState(true);
  const [geocoding, setGeocoding] = useState(false);

  // Init the map once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mod = await import('leaflet');
      const Lmod = ((mod as unknown as { default?: typeof L }).default ?? (mod as unknown as typeof L));
      if (cancelled || !elRef.current || mapRef.current) return;
      LRef.current = Lmod;
      const map = Lmod.map(elRef.current, { scrollWheelZoom: false, attributionControl: true }).setView([44.4, -79.6], 9);
      Lmod.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      // Store markers + coverage rings.
      const bounds = Lmod.latLngBounds([]);
      for (const s of stores) {
        Lmod.circle([s.lat, s.lng], { radius: 8000, color: '#2563eb', weight: 1.5, opacity: 0.4, fillColor: '#2563eb', fillOpacity: 0.05, dashArray: '5 5' }).addTo(map);
        Lmod.marker([s.lat, s.lng], { icon: Lmod.divIcon({ html: storeHtml(), className: '', iconSize: [24, 24], iconAnchor: [12, 12] }), zIndexOffset: 1000 })
          .addTo(map)
          .bindPopup(`<div style="font-weight:800;font-size:13px;color:#0f1b2d">Store ${esc(s.number)}${s.name ? ` — ${esc(s.name)}` : ''}</div><div style="font-size:12px;color:#5c6b80">Home Depot</div>`);
        bounds.extend([s.lat, s.lng]);
      }

      leadLayerRef.current = Lmod.layerGroup().addTo(map);
      mapRef.current = map;

      // Initial fit to stores (lead markers extend it below).
      if (bounds.isValid()) {
        map.fitBounds(bounds.pad(0.4));
        didFitRef.current = true;
      }
      setPending(false);
      // Leaflet needs a nudge once its container has real dimensions.
      setTimeout(() => map.invalidateSize(), 0);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Draw / redraw lead markers whenever coordinates change.
  useEffect(() => {
    const Lmod = LRef.current;
    const map = mapRef.current;
    const layer = leadLayerRef.current;
    if (!Lmod || !map || !layer) return;
    layer.clearLayers();
    const bounds = Lmod.latLngBounds([]);
    let placed = 0;
    for (const l of leads) {
      const c = coords[l.key];
      if (!c) continue;
      placed += 1;
      Lmod.marker([c.lat, c.lng], { icon: Lmod.divIcon({ html: pinHtml(COLOR[l.status]), className: '', iconSize: [24, 24], iconAnchor: [12, 22], popupAnchor: [0, -20] }) })
        .addTo(layer)
        .bindPopup(popupHtml(l));
      bounds.extend([c.lat, c.lng]);
    }
    // If we hadn't been able to fit to anything yet, fit to the leads now.
    if (placed > 0 && !didFitRef.current && bounds.isValid()) {
      map.fitBounds(bounds.pad(0.3));
      didFitRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords, leads]);

  // Progressively geocode any leads we don't yet have coordinates for. A key
  // that's undefined here is one the server had no cache for; null means the
  // server already tried and got nothing, so we skip it.
  useEffect(() => {
    let cancelled = false;
    const unique = Array.from(
      new Map(leads.filter((l) => l.key && l.query && coords[l.key] === undefined).map((l) => [l.key, l])).values(),
    );
    if (unique.length === 0) return;
    setGeocoding(true);

    (async () => {
      for (let i = 0; i < unique.length && !cancelled; i += 6) {
        const chunk = unique.slice(i, i + 6).map((l) => ({ key: l.key, query: l.query }));
        try {
          const res = await fetch('/api/leads/geocode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: chunk }),
          });
          if (!res.ok) break;
          const data = (await res.json()) as { results?: Record<string, LatLng | null> };
          if (cancelled || !data.results) continue;
          setCoords((prev) => ({ ...prev, ...data.results }));
        } catch {
          break;
        }
      }
      if (!cancelled) setGeocoding(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = leads.length;
  const placedCount = leads.filter((l) => coords[l.key]).length;
  const unplaced = total - placedCount;

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-2xl border border-gray-200 shadow-sm" style={{ height: 520 }}>
        <div ref={elRef} style={{ position: 'absolute', inset: 0 }} aria-label="Map of leads and stores" />
        {pending && (
          <div className="absolute inset-0 z-[500] flex items-center justify-center bg-gray-50 text-sm text-gray-500">
            Loading map…
          </div>
        )}
        {/* Legend */}
        <div className="pointer-events-none absolute bottom-3 left-3 z-[500] grid gap-1 rounded-xl border border-gray-200 bg-white/95 px-3 py-2 text-[11.5px] text-gray-600 shadow-sm">
          <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COLOR.new }} />New · needs a call</div>
          <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COLOR.working }} />Working</div>
          <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COLOR.booked }} />Booked &amp; sold</div>
          <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COLOR.nogood }} />No-good</div>
          <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: STORE_COLOR }} />Home Depot store</div>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          {geocoding
            ? `Placing leads on the map… (${placedCount} of ${total} so far)`
            : `${placedCount} of ${total} lead${total === 1 ? '' : 's'} on the map`}
        </span>
        {!geocoding && unplaced > 0 && <span>{unplaced} couldn&apos;t be placed (no address match)</span>}
      </div>
    </div>
  );
}
