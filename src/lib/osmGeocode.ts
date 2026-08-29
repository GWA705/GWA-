import 'server-only';

/**
 * Keyless forward geocoding via OpenStreetMap's Nominatim service — the same OSM
 * world the Leads map tiles come from, so no API key or account is needed.
 *
 * Nominatim's usage policy asks for: at most ~1 request/second, a valid
 * User-Agent identifying the app, and that results be cached (we cache every
 * hit in GeocodeCache, so a given address is only ever looked up once). We
 * serialize + throttle all calls here to stay well within that.
 *
 * Returns null for a genuine no-match; THROWS on a hard failure (HTTP / network)
 * so callers don't cache a "no result" that was really just transient.
 */

export interface GeocodeResult {
  lat: number;
  lng: number;
  label: string;
}

// Identify the app to Nominatim (required). A public business contact, per policy.
const USER_AGENT = 'GWA-DealerPortal/1.0 (+https://georgianwaterandair.ca; info@georgianwaterandair.ca)';
const MIN_GAP_MS = 1100; // a touch over the 1 req/sec ceiling

// Process-wide throttle: chain calls so only one is in flight and each is spaced.
let gate: Promise<void> = Promise.resolve();
let lastAt = 0;
function throttle(): Promise<void> {
  const next = gate.then(async () => {
    const wait = Math.max(0, MIN_GAP_MS - (Date.now() - lastAt));
    if (wait) await new Promise((r) => setTimeout(r, wait));
    lastAt = Date.now();
  });
  gate = next.catch(() => {});
  return next;
}

export async function geocodeOSM(address: string): Promise<GeocodeResult | null> {
  const q = address.trim();
  if (q.length < 4) return null;

  await throttle();

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'ca');
  url.searchParams.set('addressdetails', '0');

  const res = await fetch(url, {
    cache: 'no-store',
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en-CA', Referer: 'https://georgianwaterandair.ca' },
  });
  if (!res.ok) throw new Error(`nominatim_http_${res.status}`);
  const data = (await res.json()) as { lat?: string; lon?: string; display_name?: string }[];
  if (!Array.isArray(data) || data.length === 0) return null;
  const top = data[0];
  const lat = Number(top.lat);
  const lng = Number(top.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, label: (top.display_name || '').replace(/,\s*Canada$/i, '').trim() };
}
