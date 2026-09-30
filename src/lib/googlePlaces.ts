import 'server-only';
import { recordApiUsage, API_SERVICES } from './apiUsage';

/**
 * Server-side Google Places lookups (assessment item R1). The API key stays on
 * the server — it is never sent to the browser — so it can be locked to the
 * server's egress rather than exposed in client code. The browser only talks to
 * our own /api/places routes.
 *
 * Uses a server-only GOOGLE_MAPS_API_KEY — never a NEXT_PUBLIC_ variable, so the
 * key is never shipped to the browser. (The legacy NEXT_PUBLIC_ fallback was
 * removed once the server-only key was live in production.)
 */

function apiKey(): string | null {
  return process.env.GOOGLE_MAPS_API_KEY || null;
}

export function placesConfigured(): boolean {
  return !!apiKey();
}

export interface AddressPrediction {
  description: string;
  placeId: string;
}

export interface AddressDetails {
  street: string;
  city: string;
  province: string; // 2-letter code (e.g. ON)
  postal: string;
  formatted: string; // full address, minus a trailing ", Canada"
}

// Address predictions for a partial input (Canada, street addresses only).
export async function autocompleteAddress(input: string, sessionToken?: string): Promise<AddressPrediction[]> {
  const key = apiKey();
  const q = input.trim();
  if (!key || q.length < 3) return [];
  const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
  url.searchParams.set('input', q);
  url.searchParams.set('components', 'country:ca');
  url.searchParams.set('types', 'address');
  url.searchParams.set('language', 'en');
  url.searchParams.set('key', key);
  if (sessionToken) url.searchParams.set('sessiontoken', sessionToken);

  try {
    const res = await fetch(url, { cache: 'no-store' });
    // A request reached Google — meter it (Google bills per request sent).
    void recordApiUsage(API_SERVICES.googleAutocomplete);
    if (!res.ok) return [];
    const data = (await res.json()) as { status?: string; predictions?: { description: string; place_id: string }[] };
    if (data.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('[places] autocomplete status', data.status);
      return [];
    }
    return (data.predictions ?? []).slice(0, 6).map((p) => ({ description: p.description, placeId: p.place_id }));
  } catch (err) {
    console.error('[places] autocomplete failed', err);
    return [];
  }
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  label: string; // provider's formatted address
}

/**
 * Forward-geocode a free-form address string to a lat/lng, using the same
 * server-only Google key as the Places lookups. Metered like the other calls.
 *
 * Returns null ONLY for a genuine no-match (Google's ZERO_RESULTS) — that's safe
 * to cache. A hard failure (key missing, Geocoding API not enabled, quota, a
 * network error) THROWS instead, so the caller doesn't poison its cache with a
 * "no result" that was really just a configuration/transient problem.
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const key = apiKey();
  const q = address.trim();
  if (!key) throw new Error('geocode_unavailable: no GOOGLE_MAPS_API_KEY');
  if (q.length < 4) return null;
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', q);
  url.searchParams.set('region', 'ca');
  url.searchParams.set('language', 'en');
  // Bias toward Canada so a bare street/city resolves in-country.
  url.searchParams.set('components', 'country:CA');
  url.searchParams.set('key', key);

  const res = await fetch(url, { cache: 'no-store' });
  void recordApiUsage(API_SERVICES.googleGeocode);
  if (!res.ok) throw new Error(`geocode_http_${res.status}`);
  const data = (await res.json()) as {
    status?: string;
    error_message?: string;
    results?: { formatted_address?: string; geometry?: { location?: { lat: number; lng: number } } }[];
  };
  if (data.status === 'ZERO_RESULTS' || (data.status === 'OK' && !data.results?.length)) return null;
  if (data.status !== 'OK') {
    // REQUEST_DENIED (API not enabled / key restricted), OVER_QUERY_LIMIT, etc.
    console.error('[geocode] status', data.status, data.error_message || '');
    throw new Error(`geocode_status_${data.status}`);
  }
  const top = data.results![0];
  const loc = top.geometry?.location;
  if (!loc || typeof loc.lat !== 'number' || typeof loc.lng !== 'number') return null;
  return { lat: loc.lat, lng: loc.lng, label: (top.formatted_address || '').replace(/,\s*Canada$/i, '').trim() };
}

type Comp = { long_name: string; short_name: string; types: string[] };

/** A full Canadian postal code (A1A 1A1) — not a bare forward-sortation area. */
function isFullCanadianPostal(s: string): boolean {
  return /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d$/i.test(s.trim());
}

export interface PostalLookup {
  /** The full postal code, when Google matched confidently — else null. */
  postal: string | null;
  /**
   * True only when Google pinned a real street address. When it's false the
   * postal was a city-area guess (or missing), and we don't trust it: a wrong
   * postal that looks filled-in is worse than a blank one.
   */
  confident: boolean;
}

/**
 * Look up the postal code for a free-form address with the Google geocoder.
 *
 * We only call a postal CONFIDENT when Google resolved to an actual street
 * address (location_type ROOFTOP or RANGE_INTERPOLATED, and a street-level
 * result) and handed back a full A1A 1A1 code. A city-only or OCR-mangled
 * address resolves to a city centroid — Google still returns *a* postal, but
 * it's a guess, so we report confident:false and the caller leaves the field
 * blank. Throws (rather than returning a false "no result") on a
 * key/quota/network failure, matching geocodeAddress.
 */
export async function postalForAddress(address: string): Promise<PostalLookup> {
  const key = apiKey();
  const q = address.trim();
  if (!key) throw new Error('geocode_unavailable: no GOOGLE_MAPS_API_KEY');
  if (q.length < 6) return { postal: null, confident: false };

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', q);
  url.searchParams.set('region', 'ca');
  url.searchParams.set('language', 'en');
  url.searchParams.set('components', 'country:CA');
  url.searchParams.set('key', key);

  const res = await fetch(url, { cache: 'no-store' });
  void recordApiUsage(API_SERVICES.googleGeocode);
  if (!res.ok) throw new Error(`geocode_http_${res.status}`);
  const data = (await res.json()) as {
    status?: string;
    error_message?: string;
    results?: { address_components?: Comp[]; types?: string[]; geometry?: { location_type?: string } }[];
  };
  if (data.status === 'ZERO_RESULTS' || (data.status === 'OK' && !data.results?.length)) {
    return { postal: null, confident: false };
  }
  if (data.status !== 'OK') {
    console.error('[geocode] postal status', data.status, data.error_message || '');
    // Carry Google's status AND its human message so the admin tool can show the
    // real reason (e.g. REQUEST_DENIED: "Geocoding API has not been used…") rather
    // than a blanket "couldn't be looked up".
    throw new Error(`geocode_status_${data.status}${data.error_message ? `: ${data.error_message}` : ''}`);
  }

  const top = data.results![0];
  const postal = (top.address_components ?? []).find((c) => c.types.includes('postal_code'))?.long_name ?? null;
  const locType = top.geometry?.location_type ?? '';
  const streetLevel = (top.types ?? []).some((t) => ['street_address', 'premise', 'subpremise'].includes(t));
  const confident = !!postal && isFullCanadianPostal(postal) && (locType === 'ROOFTOP' || locType === 'RANGE_INTERPOLATED') && streetLevel;

  return { postal: confident ? postal!.toUpperCase() : null, confident };
}

// Resolve a selected prediction into structured address fields.
export async function placeDetails(placeId: string, sessionToken?: string): Promise<AddressDetails | null> {
  const key = apiKey();
  if (!key || !placeId) return null;
  const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
  url.searchParams.set('place_id', placeId);
  url.searchParams.set('fields', 'address_component,formatted_address');
  url.searchParams.set('language', 'en');
  url.searchParams.set('key', key);
  if (sessionToken) url.searchParams.set('sessiontoken', sessionToken);

  try {
    const res = await fetch(url, { cache: 'no-store' });
    void recordApiUsage(API_SERVICES.googleDetails);
    if (!res.ok) return null;
    const data = (await res.json()) as { status?: string; result?: { address_components?: Comp[]; formatted_address?: string } };
    if (data.status !== 'OK' || !data.result) return null;
    const comps = data.result.address_components ?? [];
    const get = (t: string) => comps.find((c) => c.types.includes(t));
    const street = `${get('street_number')?.long_name || ''} ${get('route')?.long_name || ''}`.trim();
    const city = get('locality')?.long_name || get('postal_town')?.long_name || get('sublocality')?.long_name || '';
    const province = get('administrative_area_level_1')?.short_name || '';
    const postal = get('postal_code')?.long_name || '';
    const formatted = (data.result.formatted_address || '').replace(/,\s*Canada$/i, '').trim();
    return { street, city, province, postal, formatted };
  } catch (err) {
    console.error('[places] details failed', err);
    return null;
  }
}
