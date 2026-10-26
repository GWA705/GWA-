import 'server-only';
import { prisma } from './db';
import { getSetting, setSetting } from './settings';

/**
 * Portal-managed recipient directory for the weekly Home Depot store reports.
 * Seeded from the GWA contacts sheet, editable in /admin/store-contacts, and the
 * single source of truth for who each store's weekly email goes to — replacing
 * the Google Sheet the old Apps Script read. The National recipient list lives
 * in a setting.
 */

const NATIONAL_KEY = 'hdReport.nationalRecipients';

/** Store number → district, for the National report roll-up (seed defaults;
 *  admins can override per store in the UI). Ported from the Apps Script. */
export const DISTRICT_SEED: Record<string, string> = {
  '7041': 'Pacific', '7043': 'Pacific', '7074': 'Pacific', '7042': 'Pacific',
  '7033': 'BC Interior', '7084': 'BC Interior', '7252': 'BC Interior', '7273': 'BC Interior', '7032': 'BC Interior', '7141': 'BC Interior',
  '7057': 'South Alberta', '7061': 'South Alberta', '7063': 'South Alberta', '7036': 'South Alberta', '7170': 'South Alberta',
  '7082': 'South Alberta', '7067': 'South Alberta', '7076': 'South Alberta', '7223': 'South Alberta', '7254': 'South Alberta',
  '7111': 'South Alberta', '7037': 'South Alberta',
  '7088': 'West Rural Markets', '7131': 'West Rural Markets', '7175': 'West Rural Markets', '7050': 'West Rural Markets',
  '7064': 'West Rural Markets', '7065': 'West Rural Markets', '7119': 'West Rural Markets', '7172': 'West Rural Markets',
  '7227': 'West Rural Markets', '7248': 'West Rural Markets', '7268': 'West Rural Markets', '7062': 'West Rural Markets',
  '7117': 'West Rural Markets', '7222': 'West Rural Markets', '7245': 'West Rural Markets', '7052': 'West Rural Markets',
  '7102': 'Manitoba/Northern Ontario', '7056': 'Manitoba/Northern Ontario', '7058': 'Manitoba/Northern Ontario',
  '7086': 'Manitoba/Northern Ontario', '7180': 'Manitoba/Northern Ontario',
  '7022': 'Northern Ontario', '7034': 'Northern Ontario',
  '7024': 'Central Ontario', '7030': 'Central Ontario', '7135': 'Central Ontario', '7137': 'Central Ontario',
  '7154': 'Central Ontario', '7160': 'Central Ontario', '7164': 'Central Ontario', '7226': 'Central Ontario',
  '7234': 'Central Ontario', '7244': 'Central Ontario', '7247': 'Central Ontario', '7264': 'Central Ontario',
  '7081': 'Ottawa Kingston', '7075': 'Ottawa Kingston', '7079': 'Ottawa Kingston', '7085': 'Ottawa Kingston',
  '7108': 'Ottawa Kingston', '7116': 'Ottawa Kingston', '7118': 'Ottawa Kingston', '7133': 'Ottawa Kingston',
  '7158': 'Ottawa Kingston', '7242': 'Ottawa Kingston', '7251': 'Ottawa Kingston', '7263': 'Ottawa Kingston',
  '7009': 'Ontario South West', '7023': 'Ontario South West', '7138': 'Ontario South West', '7153': 'Ontario South West',
  '7174': 'Ontario South West', '7178': 'Ontario South West', '7182': 'Ontario South West', '7184': 'Ontario South West',
  '7228': 'Ontario South West', '7237': 'Ontario South West',
  '7025': 'Ontario East', '7026': 'Ontario East',
  '7077': 'Atlantic Canada', '7103': 'Atlantic Canada', '7126': 'Atlantic Canada', '7173': 'Atlantic Canada',
  '7257': 'Atlantic Canada', '7261': 'Atlantic Canada',
};

export interface StoreContact {
  id: string;
  storeNumber: string;
  storeName: string | null;
  district: string | null;
  storeContacts: string | null;
  ism: string | null;
  distributor: string | null;
  officeManager: string | null;
  active: boolean;
}

/** Pull de-duplicated lowercase emails out of a free-text block (names + emails). */
export function extractEmails(text: string | null | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of (text || '').match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || []) {
    const e = m.toLowerCase().trim();
    if (!seen.has(e)) { seen.add(e); out.push(e); }
  }
  return out;
}

/** Resolve a store's recipients: To = store + distributor + office manager; Cc = ISM. */
export function resolveStoreRecipients(c: Pick<StoreContact, 'storeContacts' | 'ism' | 'distributor' | 'officeManager'>): { to: string[]; cc: string[] } {
  const to = Array.from(new Set([...extractEmails(c.storeContacts), ...extractEmails(c.distributor), ...extractEmails(c.officeManager)]));
  const cc = extractEmails(c.ism).filter((e) => !to.includes(e));
  return { to, cc };
}

export async function listStoreContacts(): Promise<StoreContact[]> {
  const rows = await prisma.hdStoreContact.findMany({ orderBy: { storeNumber: 'asc' } });
  return rows as StoreContact[];
}

export async function getStoreContact(storeNumber: string): Promise<StoreContact | null> {
  return prisma.hdStoreContact.findUnique({ where: { storeNumber } }) as Promise<StoreContact | null>;
}

export async function upsertStoreContact(input: Omit<StoreContact, 'id'>): Promise<void> {
  const { storeNumber, ...rest } = input;
  await prisma.hdStoreContact.upsert({
    where: { storeNumber },
    create: { storeNumber, ...rest },
    update: rest,
  });
}

export async function deleteStoreContact(storeNumber: string): Promise<void> {
  await prisma.hdStoreContact.delete({ where: { storeNumber } }).catch(() => {});
}

export async function getNationalRecipients(): Promise<string[]> {
  const raw = await getSetting(NATIONAL_KEY);
  return raw ? extractEmails(raw) : [];
}
export async function setNationalRecipients(text: string): Promise<void> {
  await setSetting(NATIONAL_KEY, extractEmails(text).join(', '));
}

// ---------------------------------------------------------------------------
// CSV import (the GWA "STORE CONTACTS" sheet format)
// ---------------------------------------------------------------------------

/** Minimal RFC-4180 CSV parser (handles quoted fields with commas + newlines). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let i = 0;
  let inQuotes = false;
  const s = text.replace(/\r\n?/g, '\n');
  while (i < s.length) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i += 1; continue;
      }
      field += ch; i += 1; continue;
    }
    if (ch === '"') { inQuotes = true; i += 1; continue; }
    if (ch === ',') { row.push(field); field = ''; i += 1; continue; }
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; i += 1; continue; }
    field += ch; i += 1;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export interface ParsedContactsImport {
  stores: Omit<StoreContact, 'id' | 'active'>[];
  national: string | null;
  skipped: string[];
}

/** Parse the GWA contacts sheet CSV into store rows + the national recipient list. */
export function parseContactsCsv(text: string): ParsedContactsImport {
  const rows = parseCsv(text);
  const stores: Omit<StoreContact, 'id' | 'active'>[] = [];
  const skipped: string[] = [];
  let national: string | null = null;

  for (const r of rows) {
    const label = (r[0] || '').trim();
    if (!label || /^store contact/i.test(label) || label === '') continue; // header/blank
    if (/national/i.test(label)) { national = (r[1] || '').trim(); continue; }
    const m = label.match(/\b(7\d{3})\b/);
    if (!m) { if (label) skipped.push(label); continue; }
    const storeNumber = m[1];
    const storeName = label.replace(/\b7\d{3}\b/, '').replace(/^[\s\-–]+/, '').replace(/[\s\-–]+$/, '').trim() || null;
    stores.push({
      storeNumber,
      storeName,
      district: DISTRICT_SEED[storeNumber] ?? null,
      storeContacts: (r[1] || '').trim() || null,
      ism: (r[2] || '').trim() || null,
      distributor: (r[3] || '').trim() || null,
      officeManager: (r[4] || '').trim() || null,
    });
  }
  return { stores, national, skipped };
}

/** Import the sheet: upsert every parsed store + set the national list. */
export async function importContactsCsv(text: string): Promise<{ imported: number; national: number; skipped: string[] }> {
  const parsed = parseContactsCsv(text);
  for (const s of parsed.stores) {
    await prisma.hdStoreContact.upsert({
      where: { storeNumber: s.storeNumber },
      create: { ...s, active: true },
      update: { storeName: s.storeName, district: s.district ?? undefined, storeContacts: s.storeContacts, ism: s.ism, distributor: s.distributor, officeManager: s.officeManager },
    });
  }
  if (parsed.national) await setNationalRecipients(parsed.national);
  return { imported: parsed.stores.length, national: parsed.national ? extractEmails(parsed.national).length : 0, skipped: parsed.skipped };
}
