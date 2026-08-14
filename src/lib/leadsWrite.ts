import 'server-only';
import { google, type sheets_v4 } from 'googleapis';
import { leadsSheetId } from './reporting/journalRead';

/**
 * Writes lead status back into the HD Leads Log Google Sheet, matching the
 * office's Apps Script exactly so the log stays consistent:
 *   O (col 15) = "No Good"
 *   P (col 16) = reason
 *   Q (col 17) = "Pending — Report to HD"
 *   + the row shaded light-red (#fce8e6)
 * Un-marking restores O = "Forwarded" and clears P/Q + shading.
 *
 * Needs the service account to have EDITOR access on the leads sheet.
 */

const WRITE_SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const NO_GOOD_STATUS = 'No Good';
const NO_GOOD_Q = 'Pending — Report to HD';
const RED = { red: 0.988, green: 0.909, blue: 0.901 }; // #fce8e6
const WHITE = { red: 1, green: 1, blue: 1 };

let _sheets: sheets_v4.Sheets | null = null;
async function writeClient(): Promise<sheets_v4.Sheets> {
  if (_sheets) return _sheets;
  const inline = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const auth = new google.auth.GoogleAuth({
    scopes: WRITE_SCOPES,
    ...(inline ? { credentials: JSON.parse(inline) } : {}),
  });
  _sheets = google.sheets({ version: 'v4', auth });
  return _sheets;
}

/** The 1-based row in `tab` whose Booking ID (col B) equals `bookingId`. */
async function findRowByBooking(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  tab: string,
  bookingId: string,
): Promise<number | null> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${tab}'!B1:B10000`,
    valueRenderOption: 'FORMATTED_VALUE',
  });
  const rows = res.data.values || [];
  const target = String(bookingId).trim();
  for (let i = 0; i < rows.length; i += 1) {
    if (String(rows[i]?.[0] ?? '').trim() === target) return i + 1;
  }
  return null;
}

async function tabGid(sheets: sheets_v4.Sheets, spreadsheetId: string, tab: string): Promise<number | null> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties(title,sheetId)' });
  const s = (meta.data.sheets || []).find((x) => x.properties?.title === tab);
  return s?.properties?.sheetId ?? null;
}

async function shadeRow(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  tab: string,
  row: number,
  color: { red: number; green: number; blue: number },
): Promise<void> {
  const gid = await tabGid(sheets, spreadsheetId, tab);
  if (gid == null) return;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: { sheetId: gid, startRowIndex: row - 1, endRowIndex: row, startColumnIndex: 0, endColumnIndex: 18 },
            cell: { userEnteredFormat: { backgroundColor: color } },
            fields: 'userEnteredFormat.backgroundColor',
          },
        },
      ],
    },
  });
}

export async function markLeadNoGood(
  tab: string,
  bookingId: string,
  reason: string,
  byName?: string,
): Promise<{ ok: boolean; error?: string }> {
  const id = leadsSheetId();
  if (!id) return { ok: false, error: 'Leads sheet is not configured.' };
  try {
    const sheets = await writeClient();
    const row = await findRowByBooking(sheets, id, tab, bookingId);
    if (!row) return { ok: false, error: 'That lead was not found in the log.' };
    // Record who flagged it right in the reason cell, so the log itself shows it.
    const reasonCell = `${(reason || 'No reason provided').trim()}${byName ? ` — ${byName}` : ''}`.slice(0, 480);
    await sheets.spreadsheets.values.update({
      spreadsheetId: id,
      range: `'${tab}'!O${row}:Q${row}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[NO_GOOD_STATUS, reasonCell, NO_GOOD_Q]] },
    });
    try {
      await shadeRow(sheets, id, tab, row, RED);
    } catch {
      /* shading is cosmetic — don't fail the whole action on it */
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function unmarkLeadNoGood(tab: string, bookingId: string): Promise<{ ok: boolean; error?: string }> {
  const id = leadsSheetId();
  if (!id) return { ok: false, error: 'Leads sheet is not configured.' };
  try {
    const sheets = await writeClient();
    const row = await findRowByBooking(sheets, id, tab, bookingId);
    if (!row) return { ok: false, error: 'That lead was not found in the log.' };
    await sheets.spreadsheets.values.update({
      spreadsheetId: id,
      range: `'${tab}'!O${row}:Q${row}`,
      valueInputOption: 'RAW',
      requestBody: { values: [['Forwarded', '', '']] },
    });
    try {
      await shadeRow(sheets, id, tab, row, WHITE);
    } catch {
      /* ignore */
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
