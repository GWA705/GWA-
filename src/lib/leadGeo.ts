import 'server-only';
import { prisma } from './db';
import { geocodeOSM } from './osmGeocode';
import { parseLeadAddress, leadKeyOf, type Lead } from './leads';

/**
 * Geocoding for the Leads map. Lead addresses and Home Depot store locations are
 * turned into lat/lng once and cached (GeocodeCache table / store columns), so
 * the map is fast and we don't re-hit Google on every load. The visible map is
 * Leaflet + OpenStreetMap tiles; this module only provides the coordinates.
 */

export interface LatLng {
  lat: number;
  lng: number;
}
export interface StoreGeo {
  number: string;
  name: string;
  lat: number;
  lng: number;
}

/** Whether geocoding is possible. OSM/Nominatim is keyless, so always true. */
export function geocodingConfigured(): boolean {
  return true;
}

/** Normalize any address string into a stable cache key. */
function normKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The address string we send to the geocoder for a lead (structured if we can). */
export function leadGeoQuery(l: Lead): string {
  const p = parseLeadAddress(l.address || '');
  const bits = [p.street, p.city, p.province, p.postal].map((x) => x.trim()).filter(Boolean);
  const structured = bits.join(', ');
  return (structured || (l.address || '').trim()) + (bits.length || l.address ? ', Canada' : '');
}

/** Stable geocode-cache key for a lead (by its address, so it's shared/reused). */
export function leadGeoKey(l: Lead): string {
  return normKey(leadGeoQuery(l));
}

/** Read cached coordinates for these keys. Only *placed* rows are returned; a
 *  "no result" (null) row is treated as unknown so the map will retry it — this
 *  is what lets a batch that failed under a config outage heal once it's fixed. */
export async function getCachedGeocodes(keys: string[]): Promise<Record<string, LatLng | null>> {
  const uniq = Array.from(new Set(keys.filter(Boolean)));
  if (uniq.length === 0) return {};
  const rows = await prisma.geocodeCache.findMany({ where: { key: { in: uniq }, latitude: { not: null }, longitude: { not: null } } });
  const out: Record<string, LatLng | null> = {};
  for (const r of rows) {
    if (r.latitude != null && r.longitude != null) out[r.key] = { lat: r.latitude, lng: r.longitude };
  }
  return out;
}

/**
 * Geocode one address (by its cache key). A successful hit is cached forever; a
 * genuine no-match is cached as null but stays *retryable* (we only short-circuit
 * on a placed row). A hard failure (API not enabled, quota, network) throws out
 * of geocodeOSM — we swallow it and write nothing, so nothing is poisoned.
 */
async function geocodeOne(key: string, query: string): Promise<LatLng | null> {
  const existing = await prisma.geocodeCache.findUnique({ where: { key } });
  if (existing && existing.latitude != null && existing.longitude != null) {
    return { lat: existing.latitude, lng: existing.longitude };
  }
  let hit: Awaited<ReturnType<typeof geocodeOSM>>;
  try {
    hit = await geocodeOSM(query);
  } catch {
    return null; // transient/config failure — leave the cache untouched, retry later
  }
  await prisma.geocodeCache.upsert({
    where: { key },
    create: { key, latitude: hit?.lat ?? null, longitude: hit?.lng ?? null, label: hit?.label ?? null },
    update: { latitude: hit?.lat ?? null, longitude: hit?.lng ?? null, label: hit?.label ?? null },
  });
  return hit ? { lat: hit.lat, lng: hit.lng } : null;
}

/**
 * Geocode a batch of {key, query} items (used by the /api/leads/geocode route to
 * fill the cache progressively). Capped by the caller; runs sequentially to be
 * gentle on the geocoder. Returns a map key → LatLng|null.
 */
export async function geocodeBatch(items: { key: string; query: string }[]): Promise<Record<string, LatLng | null>> {
  const out: Record<string, LatLng | null> = {};
  for (const it of items) {
    if (!it.key || !it.query) continue;
    try {
      out[it.key] = await geocodeOne(it.key, it.query);
    } catch {
      out[it.key] = null;
    }
  }
  return out;
}

export interface LeadGeoEntry {
  geoKey: string;
  query: string;
  coord?: LatLng | null; // undefined = not cached yet; null = tried, no result
}

/**
 * Build the map data for a set of leads: each lead's stable key → its geocode
 * key, geocoder query, and cached coordinate (if any). Only reads the cache —
 * uncached leads are filled in later by the map via /api/leads/geocode.
 */
export async function leadsGeoData(leads: Lead[]): Promise<Record<string, LeadGeoEntry>> {
  const entries = leads.map((l) => ({ leadKey: leadKeyOf(l), geoKey: leadGeoKey(l), query: leadGeoQuery(l) }));
  const cached = await getCachedGeocodes(entries.map((e) => e.geoKey));
  const out: Record<string, LeadGeoEntry> = {};
  for (const e of entries) {
    out[e.leadKey] = { geoKey: e.geoKey, query: e.query, coord: e.geoKey in cached ? cached[e.geoKey] : undefined };
  }
  return out;
}

/** Store coordinates for the Leads map, scoped to one dealer (or all offices). */
export async function storeGeos(dealerId?: string): Promise<StoreGeo[]> {
  const stores = await prisma.homeDepotStore.findMany({
    where: { active: true, ...(dealerId ? { dealerId } : {}) },
    select: { id: true, number: true, name: true, latitude: true, longitude: true },
  });
  return ensureStoreCoords(stores);
}

/**
 * Ensure each store has coordinates, geocoding any that don't (by store name) and
 * saving them back onto the store row. Returns only the stores we could place.
 * Stores without a name can't be geocoded and are skipped.
 */
export async function ensureStoreCoords(
  stores: { id: string; number: string; name: string | null; latitude: number | null; longitude: number | null }[],
): Promise<StoreGeo[]> {
  const out: StoreGeo[] = [];
  const canGeocode = geocodingConfigured();
  for (const s of stores) {
    const name = (s.name || '').trim();
    if (s.latitude != null && s.longitude != null) {
      out.push({ number: s.number, name, lat: s.latitude, lng: s.longitude });
      continue;
    }
    if (!canGeocode || !name) continue;
    let hit: Awaited<ReturnType<typeof geocodeOSM>> = null;
    try {
      hit = await geocodeOSM(`The Home Depot ${name}, Ontario, Canada`);
    } catch {
      continue; // config/transient failure — leave unplaced, admin can set it by hand
    }
    if (hit) {
      await prisma.homeDepotStore.update({
        where: { id: s.id },
        data: { latitude: hit.lat, longitude: hit.lng, geocodedAt: new Date() },
      });
      out.push({ number: s.number, name, lat: hit.lat, lng: hit.lng });
    }
  }
  return out;
}
