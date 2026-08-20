import 'server-only';
import { prisma } from './db';
import { leadsSheetId, pingSheet, readSheetTab } from './reporting/journalRead';

/**
 * Reader for the "HD Leads Log" Google Sheet. Leads are emailed to each office
 * and written to this sheet by an Apps Script; the portal reads it (read-only)
 * to give each office a searchable, view-only list plus running totals of leads
 * received and leads marked "No Good". Attribution to an office is by HD store
 * number (col C) → the dealer that store belongs to — the same mapping the
 * reports use. The No-Good status is read straight from the sheet (col O).
 */

export interface Lead {
  rowId: string;
  dateReceived: Date | null;
  dateText: string;
  bookingId: string;
  storeNumber: string;
  service: string;
  customerName: string;
  phone: string;
  email: string;
  address: string;
  contactPreference: string;
  emergency: string;
  serviceDetails: string;
  additionalInfo: string;
  financing: string;
  forwardedTo: string;
  status: string;
  noGood: boolean;
  noGoodReason: string;
  reportedToHd: string;
  dateReported: string;
}

export interface LeadsRead {
  leads: Lead[];
  configured: boolean;
  error?: string;
}

const PROVINCE_CODES = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'];

/** Split an HD lead's "CUSTOMER NAME" into first + last (best effort). */
export function parseLeadName(raw: string): { first: string; last: string } {
  const t = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return { first: '', last: '' };
  // "Last, First" form.
  if (t.includes(',')) {
    const [last, first] = t.split(',').map((s) => s.trim());
    return { first: first || '', last: last || '' };
  }
  const parts = t.split(' ');
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

export interface ParsedLeadAddress {
  street: string;
  city: string;
  province: string; // 2-letter code, e.g. ON
  postal: string;
}

/**
 * Pull street / city / province / postal out of an HD lead's single address
 * string (e.g. "1306 SPYGLASS POINT RD, RAMARA ON, L0K 1B0"). Best effort — the
 * dealer confirms; we fill what we can read.
 */
export function parseLeadAddress(raw: string): ParsedLeadAddress {
  const out: ParsedLeadAddress = { street: '', city: '', province: '', postal: '' };
  let s = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (!s) return out;

  // Postal code (Canadian). Normalize to "A1A 1A1".
  const pm = s.match(/[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d/);
  if (pm) {
    const p = pm[0].toUpperCase().replace(/\s/g, '');
    out.postal = `${p.slice(0, 3)} ${p.slice(3)}`;
    s = (s.slice(0, pm.index) + s.slice((pm.index ?? 0) + pm[0].length)).trim();
  }
  // Province (word-boundary 2-letter code).
  const provRe = new RegExp(`\\b(${PROVINCE_CODES.join('|')})\\b`, 'i');
  const provM = s.match(provRe);
  if (provM) {
    out.province = provM[1].toUpperCase();
    s = s.replace(provRe, ' ').replace(/\s+/g, ' ').trim();
  }
  // Tidy stray commas, then split street from city on the comma.
  s = s
    .replace(/\s*,\s*/g, ',')
    .replace(/^,+|,+$/g, '')
    .trim();
  const parts = s.split(',').map((t) => t.trim()).filter(Boolean);
  if (parts.length >= 2) {
    out.street = parts[0];
    out.city = parts.slice(1).join(' ').trim();
  } else if (parts.length === 1) {
    out.street = parts[0];
  }
  return out;
}

/** Find a lead by its HD booking number (701…), comparing on digits only. */
export function findLeadByBooking(leads: Lead[], booking: string): Lead | null {
  const target = String(booking ?? '').replace(/\D/g, '');
  if (target.length < 4) return null;
  return leads.find((l) => String(l.bookingId ?? '').replace(/\D/g, '') === target) ?? null;
}

function norm(s: unknown): string {
  return String(s ?? '').trim().toLowerCase();
}

// Field → header matchers (first matching, unused column wins). `exact` means the
// normalized header must equal the string; otherwise it's a substring match.
const FIELD_MATCHERS: { key: keyof Lead; needles: string[]; exact?: boolean }[] = [
  { key: 'dateReceived', needles: ['date received'] },
  { key: 'bookingId', needles: ['booking'] },
  { key: 'storeNumber', needles: ['store'] },
  { key: 'serviceDetails', needles: ['service details'] },
  { key: 'service', needles: ['service'], exact: true },
  { key: 'customerName', needles: ['customer name', 'customer'] },
  { key: 'phone', needles: ['phone'] },
  { key: 'email', needles: ['email'], exact: true },
  { key: 'address', needles: ['project address', 'address'] },
  { key: 'contactPreference', needles: ['contact preference'] },
  { key: 'emergency', needles: ['emergency'] },
  { key: 'additionalInfo', needles: ['additional info'] },
  { key: 'financing', needles: ['financing'] },
  { key: 'forwardedTo', needles: ['forwarded to'] },
  { key: 'noGoodReason', needles: ['no good reason'] },
  { key: 'status', needles: ['status'], exact: true },
  { key: 'reportedToHd', needles: ['reported to hd'] },
  { key: 'dateReported', needles: ['date reported'] },
];

function buildColMap(header: string[]): Partial<Record<keyof Lead, number>> {
  const cells = header.map(norm);
  const used = new Set<number>();
  const map: Partial<Record<keyof Lead, number>> = {};
  for (const m of FIELD_MATCHERS) {
    for (const needle of m.needles) {
      let found = -1;
      for (let i = 0; i < cells.length; i += 1) {
        if (used.has(i)) continue;
        if (m.exact ? cells[i] === needle : cells[i].includes(needle)) {
          found = i;
          break;
        }
      }
      if (found !== -1) {
        map[m.key] = found;
        used.add(found);
        break;
      }
    }
  }
  return map;
}

function parseDate(v: string): Date | null {
  if (!v) return null;
  const d = new Date(v.trim());
  return isNaN(d.getTime()) ? null : d;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
let _cache: { at: number; value: LeadsRead } | null = null;

async function readLeadsUncached(): Promise<LeadsRead> {
  const id = leadsSheetId();
  if (!id) return { leads: [], configured: false };

  // Find the tab that carries the leads header.
  let tabs: string[] = [];
  const meta = await pingSheet(id);
  if (meta.error) return { leads: [], configured: true, error: meta.error };
  tabs = meta.tabs ?? [];
  if (tabs.length === 0) return { leads: [], configured: true, error: 'No tabs found in the leads sheet.' };

  for (const tab of tabs) {
    let grid: string[][];
    try {
      grid = await readSheetTab(id, tab);
    } catch (e) {
      return { leads: [], configured: true, error: (e as Error).message };
    }
    if (grid.length === 0) continue;
    const headerIdx = grid.findIndex((r) => r.join('|').toLowerCase().includes('date received'));
    if (headerIdx === -1) continue;

    const colMap = buildColMap(grid[headerIdx]);
    const get = (row: string[], key: keyof Lead): string => {
      const c = colMap[key];
      return c == null ? '' : String(row[c] ?? '').trim();
    };

    const leads: Lead[] = [];
    for (let r = headerIdx + 1; r < grid.length; r += 1) {
      const row = grid[r] || [];
      const dateText = get(row, 'dateReceived');
      const customerName = get(row, 'customerName');
      if (!dateText && !customerName) continue; // skip blank rows
      const status = get(row, 'status');
      leads.push({
        rowId: `${tab}-${r + 1}`,
        dateReceived: parseDate(dateText),
        dateText,
        bookingId: get(row, 'bookingId'),
        storeNumber: (get(row, 'storeNumber').match(/\d{3,}/) || [get(row, 'storeNumber')])[0] || '',
        service: get(row, 'service'),
        customerName,
        phone: get(row, 'phone'),
        email: get(row, 'email'),
        address: get(row, 'address'),
        contactPreference: get(row, 'contactPreference'),
        emergency: get(row, 'emergency'),
        serviceDetails: get(row, 'serviceDetails'),
        additionalInfo: get(row, 'additionalInfo'),
        financing: get(row, 'financing'),
        forwardedTo: get(row, 'forwardedTo'),
        status,
        noGood: /no\s*good|^ng$/i.test(status),
        noGoodReason: cleanNoGoodReason(get(row, 'noGoodReason')),
        reportedToHd: get(row, 'reportedToHd'),
        dateReported: get(row, 'dateReported'),
      });
    }
    // newest first
    leads.sort((a, b) => (b.dateReceived?.getTime() ?? 0) - (a.dateReceived?.getTime() ?? 0));
    return { leads, configured: true };
  }

  return { leads: [], configured: true, error: 'Could not find a leads table (a "Date Received" header) in the sheet.' };
}

export async function readLeads(force = false): Promise<LeadsRead> {
  const now = Date.now();
  if (!force && _cache && now - _cache.at < CACHE_TTL_MS) return _cache.value;
  const value = await readLeadsUncached();
  if (!value.error) _cache = { at: now, value };
  return value;
}

/** Drop the cached leads so the next read reflects a just-written change. */
export function clearLeadsCache(): void {
  _cache = null;
}

/** Split a lead rowId ("<tab>-<rowNumber>") back into its tab + 1-based row. */
export function parseLeadRowId(rowId: string): { tab: string; row: number } | null {
  const cut = rowId.lastIndexOf('-');
  if (cut <= 0) return null;
  const tab = rowId.slice(0, cut);
  const row = parseInt(rowId.slice(cut + 1), 10);
  if (!tab || !Number.isFinite(row) || row < 1) return null;
  return { tab, row };
}

/** Store numbers assigned to a dealer (for office-scoped lead filtering). */
export async function dealerStoreNumbers(dealerId: string): Promise<string[]> {
  const stores = await prisma.homeDepotStore.findMany({ where: { dealerId }, select: { number: true } });
  return Array.from(new Set(stores.map((s) => s.number.trim()).filter(Boolean)));
}

/**
 * HD store number → store name/location, so leads can show "Store 7234 —
 * Barrie". Scoped to one dealer when `dealerId` is given, else all offices.
 */
export async function storeNameMap(dealerId?: string): Promise<Record<string, string>> {
  const stores = await prisma.homeDepotStore.findMany({
    where: dealerId ? { dealerId } : {},
    select: { number: true, name: true },
  });
  const map: Record<string, string> = {};
  for (const s of stores) {
    const num = s.number.trim();
    const name = (s.name ?? '').trim();
    if (num && name) map[num] = name;
  }
  return map;
}

// Markers that begin the raw Home Depot lead-notification boilerplate — when a
// no-good reason has the whole lead email pasted after it, we cut at the first
// of these so only the human-written reason remains.
const NOGOOD_BOILERPLATE = [
  /new home depot lead/i,
  /\*\s*important\b/i,
  /important:\s*customers? must be contacted/i,
  /\bbooking id\b\s*:?\s*\d/i,
  /\bdate received\b/i,
];

/** Keep only the human reason: trim off any pasted HD lead boilerplate. */
export function cleanNoGoodReason(raw: string): string {
  const s = (raw || '').replace(/\s+/g, ' ').trim();
  let cut = -1;
  for (const re of NOGOOD_BOILERPLATE) {
    const m = s.match(re);
    if (m && m.index != null && (cut === -1 || m.index < cut)) cut = m.index;
  }
  // Only trim when there's real reason text before the boilerplate; otherwise
  // leave it as-is (don't blank content we might have misdetected).
  const out = cut > 0 ? s.slice(0, cut) : s;
  return out.replace(/[\s·,\-–—;:]+$/, '').trim();
}

export function summarize(leads: Lead[]): { total: number; noGood: number; forwarded: number } {
  const noGood = leads.filter((l) => l.noGood).length;
  return { total: leads.length, noGood, forwarded: leads.length - noGood };
}

/**
 * A stable key for a lead, used to attach call-tracking records. Prefers the HD
 * Booking ID (never changes); falls back to a name+phone+store hash so leads
 * without a booking id still track. Must match between logging and reading.
 */
export function leadKeyOf(l: Lead): string {
  const booking = (l.bookingId ?? '').trim();
  if (booking) return `b:${booking}`;
  const name = (l.customerName ?? '').toLowerCase().replace(/\s+/g, '');
  const phone = (l.phone ?? '').replace(/\D/g, '');
  return `h:${name}|${phone}|${(l.storeNumber ?? '').trim()}`;
}
