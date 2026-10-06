import 'server-only';
import { google, type sheets_v4 } from 'googleapis';
import type { RoutingRow } from './storeRoutingDiff';

/**
 * Read/write the "Dealer ↔ HD Store Routing" Google Sheet — the backup + control
 * surface for store→dealer routing. The portal stays the live master; this sheet
 * is written from the portal ("Back up to sheet") and read back with a reviewed
 * preview ("Pull from sheet"). Uses the same service account as the journal.
 *
 * Setup (one-time): create a sheet in your Drive, share it (Editor) with the
 * service-account email, and set MAPPING_SHEET_ID on the server.
 */

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const TAB = 'Routing';
const HEADER = ['Store #', 'City / Name', 'Office (dealer)', 'Active (Yes/No)'];

export function routingSheetId(): string | null {
  return process.env.MAPPING_SHEET_ID || null;
}

export function routingSheetConfigured(): boolean {
  return Boolean(
    routingSheetId() &&
      (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
  );
}

let _sheets: sheets_v4.Sheets | null = null;
async function sheetsClient(): Promise<sheets_v4.Sheets> {
  if (_sheets) return _sheets;
  const inline = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const auth = new google.auth.GoogleAuth({
    scopes: SCOPES,
    ...(inline ? { credentials: JSON.parse(inline) } : {}),
  });
  _sheets = google.sheets({ version: 'v4', auth });
  return _sheets;
}

/** Ensure the "Routing" tab exists; returns the spreadsheet title for messages. */
async function ensureTab(sheets: sheets_v4.Sheets, spreadsheetId: string): Promise<string> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'properties.title,sheets.properties.title' });
  const titles = (meta.data.sheets ?? []).map((s) => s.properties?.title);
  if (!titles.includes(TAB)) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: TAB } } }] },
    });
  }
  return meta.data.properties?.title ?? 'the sheet';
}

const yesNo = (b: boolean) => (b ? 'Yes' : 'No');
const toBool = (s: string) => !/^\s*(no|n|false|0|inactive)\s*$/i.test(String(s ?? '').trim());

/** Overwrite the sheet with the portal's current mapping (one row per store). */
export async function backupRoutingToSheet(rows: RoutingRow[]): Promise<{ wrote: number; title: string }> {
  const spreadsheetId = routingSheetId();
  if (!spreadsheetId) throw new Error('MAPPING_SHEET_ID is not configured.');
  const sheets = await sheetsClient();
  const title = await ensureTab(sheets, spreadsheetId);

  const values = [HEADER, ...rows.map((r) => [r.number, r.city, r.dealerName, yesNo(r.active)])];
  // Clear generously, then write from A1 — so a shrinking list leaves no stragglers.
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${TAB}!A1:D100000` });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${TAB}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values },
  });
  return { wrote: rows.length, title };
}

/** Read the mapping rows the sheet currently holds (skips blank / header rows). */
export async function readRoutingFromSheet(): Promise<RoutingRow[]> {
  const spreadsheetId = routingSheetId();
  if (!spreadsheetId) throw new Error('MAPPING_SHEET_ID is not configured.');
  const sheets = await sheetsClient();
  await ensureTab(sheets, spreadsheetId);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${TAB}!A2:D` });
  const grid = res.data.values ?? [];
  const out: RoutingRow[] = [];
  for (const row of grid) {
    const number = String(row[0] ?? '').trim();
    const city = String(row[1] ?? '').trim();
    const dealerName = String(row[2] ?? '').trim();
    if (!number && !dealerName) continue; // blank row
    out.push({ number, city, dealerName, active: toBool(String(row[3] ?? 'Yes')) });
  }
  return out;
}
