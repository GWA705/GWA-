import 'server-only';

/**
 * Server-side Google Places lookups (assessment item R1). The API key stays on
 * the server — it is never sent to the browser — so it can be locked to the
 * server's egress rather than exposed in client code. The browser only talks to
 * our own /api/places routes.
 *
 * Prefers a server-only GOOGLE_MAPS_API_KEY; falls back to the legacy
 * NEXT_PUBLIC_GOOGLE_MAPS_API_KEY during the transition (rename it to drop the
 * NEXT_PUBLIC_ prefix so it isn't shipped to the browser at all).
 */

function apiKey(): string | null {
  return process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || null;
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

type Comp = { long_name: string; short_name: string; types: string[] };

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
