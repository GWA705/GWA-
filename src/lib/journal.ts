import { google, type sheets_v4 } from 'googleapis';
import { parseFlexibleDate } from './reporting/journalRead';

/**
 * Google Sheets "sales journal" writer.
 *
 * Pushes an approved deal into the GHS sales journal spreadsheet — one row per
 * deal, on the monthly tab that matches the deal's SALE date. Pressing "Write
 * to Journal" again UPDATES the same row (we remember the tab + row on the
 * Application) rather than appending a duplicate.
 *
 * Design decisions (agreed with the business):
 *  - The tab is chosen by the deal's SALE date (e.g. a July sale → the July tab).
 *  - The deal lands on the next EMPTY numbered row; the journal's own "No."
 *    numbering column is left untouched.
 *  - Only factual columns the portal actually holds are written. Calculated
 *    columns (Net, TAX, REC'BLE, Balance…) and manual workflow columns
 *    (Result, SAM SENT, salesperson/installer…) are never touched.
 *  - Auth is a Google service account. On Render the JSON key is mounted as a
 *    Secret File and GOOGLE_APPLICATION_CREDENTIALS points at it; GoogleAuth
 *    picks it up automatically. No key material lives in the repo.
 *
 * This is best-effort: the portal's database is the source of truth. A failure
 * here never blocks the deal — the caller surfaces the error and the reviewer
 * can retry.
 */

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

/** True when the journal integration is configured (sheet id + credentials). */
export function journalEnabled(): boolean {
  return Boolean(
    process.env.JOURNAL_SHEET_ID &&
      (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
  );
}

/**
 * The LIVE journal spreadsheet id for a given calendar year, from env.
 * Pattern: JOURNAL_SHEET_ID_<year>. 2026 falls back to the base JOURNAL_SHEET_ID
 * so an existing single-sheet setup keeps working. Add one env var per new year
 * (and share that sheet with the service account) — no code change needed.
 */
export function liveSheetIdForYear(year: number): string | null {
  const explicit = process.env[`JOURNAL_SHEET_ID_${year}`];
  if (explicit) return explicit;
  if (year === 2026) return process.env.JOURNAL_SHEET_ID || null;
  return null;
}

/**
 * Resolve which journal spreadsheet the WRITE path targets for a deal's sale
 * year, honoring the admin "write mode" toggle:
 *   - 'test' (default): the single safe test journal (JOURNAL_SHEET_ID), for
 *     every year — this is the shakeout sandbox.
 *   - 'live': the real journal FOR THAT YEAR (JOURNAL_SHEET_ID_<year>). A deal
 *     sold in 2027 writes to the 2027 journal automatically; a 2026 deal to the
 *     2026 journal — the year is picked from the deal's sale date.
 * Reporting reads always use the live per-year journals, independent of this.
 */
async function resolveWriteSheetId(year: number): Promise<string> {
  const { getJournalWriteMode } = await import('./settings');
  const mode = await getJournalWriteMode();
  if (mode === 'test') {
    const test = process.env.JOURNAL_SHEET_ID;
    if (!test) throw new Error('No test journal is configured (JOURNAL_SHEET_ID).');
    return test;
  }
  const id = liveSheetIdForYear(year);
  if (!id) {
    throw new Error(
      `No live journal is configured for ${year}. Add JOURNAL_SHEET_ID_${year} on the server and share that sheet with the service account.`,
    );
  }
  return id;
}

let _sheets: sheets_v4.Sheets | null = null;
async function sheetsClient(): Promise<sheets_v4.Sheets> {
  if (_sheets) return _sheets;
  // Prefer an explicit inline JSON blob if provided; otherwise fall back to the
  // GOOGLE_APPLICATION_CREDENTIALS file path (the Render Secret File).
  const inline = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const auth = new google.auth.GoogleAuth({
    scopes: SCOPES,
    ...(inline ? { credentials: JSON.parse(inline) } : {}),
  });
  _sheets = google.sheets({ version: 'v4', auth });
  return _sheets;
}

// --- Column-letter helpers -------------------------------------------------

/** 0-based column index → A1 letter (0→A, 26→AA). */
export function colLetter(index: number): string {
  let n = index;
  let s = '';
  do {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

function norm(s: unknown): string {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// --- Tab (month) resolution ------------------------------------------------

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

/**
 * Pick the spreadsheet tab whose title matches the sale date's month + year.
 * Tolerates the journal's naming variants ("Jan.2026", "January 2026",
 * "Jan 26", …) by matching on the month prefix and the 4- or 2-digit year.
 */
export function matchTab(titles: string[], when: Date): string | null {
  const monthFull = MONTHS[when.getUTCMonth()];
  const monthAbbr = monthFull.slice(0, 3); // "jul"
  const yearFull = String(when.getUTCFullYear()); // "2026"
  const yearShort = yearFull.slice(-2); // "26"
  for (const title of titles) {
    const n = norm(title); // e.g. "jul 2026", "july 2026", "jul 26"
    const hasMonth = n.includes(monthAbbr);
    const hasYear = n.includes(yearFull) || new RegExp(`\\b${yearShort}\\b`).test(n);
    if (hasMonth && hasYear) return title;
  }
  return null;
}

// --- Header mapping --------------------------------------------------------

// Fields we write, in priority order, each matched against the COMBINED header
// (top row + bottom row of the two-row header). The combined text disambiguates
// the journal's duplicate single-row labels ("Amount" appears twice, etc.).
// `test` receives the normalized combined header for one column.
interface FieldSpec {
  key: string;
  test: (combined: string, bottom: string) => boolean;
}

const FIELD_SPECS: FieldSpec[] = [
  { key: 'lastName', test: (_c, b) => b === 'last name' },
  { key: 'firstName', test: (_c, b) => b === 'first name' },
  { key: 'hdRef', test: (_c, b) => b.startsWith('hd ref') },
  { key: 'hdStore', test: (_c, b) => b.startsWith('hd store') },
  // The finance/loan number. Some tabs have a dedicated "Loan #" column; this
  // journal instead carries it under "Finance Co. #" (top "Finance Co.", bottom
  // "#", which normalizes the combined header to exactly "finance co"). The
  // money column "Amt. Paid By / Finance Co." is NOT matched (its combined
  // header is "amt paid by finance co", not the exact "finance co").
  { key: 'loanNo', test: (c, b) => b === 'loan' || b.startsWith('loan ') || c === 'finance co' },
  { key: 'term', test: (_c, b) => b.startsWith('term') },
  // The non-financed "Cash/Chq /CC Amount" (column J) — distinct from the
  // "Financed Amount" column below (matched exactly to avoid grabbing this one).
  { key: 'cashAmount', test: (c) => c.includes('cash') },
  { key: 'financedAmount', test: (c) => c === 'financed amount' },
  // "How They Payed" code column (top "How They", bottom "Payed").
  { key: 'payCode', test: (_c, b) => b === 'payed' },
  // Column O is headed "Location" (top) with a blank bottom row → dealer name.
  // NB: do NOT map the finance company here — the only "Finance Co." header is
  // the bottom half of "Amt. Paid By / Finance Co.", which is a dollar/formula
  // column, so writing a name there breaks the sheet's math.
  { key: 'location', test: (c) => c === 'location' },
  { key: 'salesperson', test: (c) => c === 'dealer s name' }, // journal "Dealer's Name"
  { key: 'installer', test: (c) => c === 'installer s name' },
  { key: 'products', test: (c) => c.includes('product') },
  { key: 'soap', test: (c) => c.includes('soap') },
  { key: 'address', test: (_c, b) => b === 'address' },
  { key: 'city', test: (_c, b) => b.startsWith('city') },
  { key: 'prov', test: (_c, b) => b === 'prov' || b.startsWith('prov') },
  { key: 'postal', test: (c, b) => b === 'code' || c.includes('postal') },
  { key: 'phone', test: (_c, b) => b.startsWith('phone') },
  { key: 'dealDate', test: (c) => c === 'date' }, // top blank, bottom "Date"
  { key: 'dateInstalled', test: (c, b) => b === 'installed' || c.includes('date installed') },
  { key: 'dateOfSale', test: (c) => c === 'date of sale' },
];

export interface JournalLayout {
  headerBottomRow: number; // 1-based sheet row of the "No." header row
  firstDataRow: number; // 1-based sheet row where data begins
  columns: Record<string, number>; // field key → 0-based column index
  rows: string[][]; // raw values (from row 1)
}

/** Fetch a tab's grid and work out where the header + columns live. */
async function readLayout(
  sheets: sheets_v4.Sheets,
  tab: string,
  spreadsheetId: string,
): Promise<JournalLayout> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${tab}'!A1:BZ500`,
    valueRenderOption: 'FORMATTED_VALUE',
  });
  const rows: string[][] = (res.data.values as string[][]) || [];

  // The bottom header row is the one whose column A is "No." and which also
  // carries "Last Name" somewhere — that anchors the two-row header block.
  let headerBottom = -1;
  for (let r = 0; r < rows.length; r += 1) {
    const row = rows[r] || [];
    if (norm(row[0]) === 'no' && row.some((c) => norm(c) === 'last name')) {
      headerBottom = r;
      break;
    }
  }
  if (headerBottom < 0) {
    throw new Error(`Could not find the header row (looking for "No." + "Last Name") on tab "${tab}".`);
  }
  const top = rows[headerBottom - 1] || [];
  const bottom = rows[headerBottom] || [];

  const width = Math.max(top.length, bottom.length);
  const columns: Record<string, number> = {};
  const used = new Set<number>();
  for (const spec of FIELD_SPECS) {
    for (let c = 0; c < width; c += 1) {
      if (used.has(c)) continue;
      const combined = norm(`${top[c] ?? ''} ${bottom[c] ?? ''}`);
      const b = norm(bottom[c]);
      if (spec.test(combined, b)) {
        columns[spec.key] = c;
        used.add(c);
        break;
      }
    }
  }

  return {
    headerBottomRow: headerBottom + 1,
    firstDataRow: headerBottom + 2,
    columns,
    rows,
  };
}

// --- Row selection ---------------------------------------------------------

/**
 * Decide which sheet row this deal should occupy.
 *  1. If we already synced it and that row still looks like this deal (same
 *     last name, or empty), reuse it — that's the update-in-place path.
 *  2. Otherwise look for an existing row matching the HD ref / loan number
 *     (covers the live journal, which has no hidden id column).
 *  3. Otherwise take the next empty numbered row (the "Last Name" cell blank).
 */
function chooseRow(
  layout: JournalLayout,
  deal: { lastName: string; hdRef: string | null; loanNo: string | null; knownRow: number | null },
): number {
  const lastNameCol = layout.columns.lastName;
  const cellAt = (row1: number, col: number) => norm((layout.rows[row1 - 1] || [])[col]);

  // 1. Reuse the remembered row when it still matches (or was cleared).
  if (deal.knownRow && deal.knownRow >= layout.firstDataRow) {
    const existing = cellAt(deal.knownRow, lastNameCol);
    if (existing === '' || existing === norm(deal.lastName)) return deal.knownRow;
  }

  // 2. Match an existing row by reference number.
  const hdCol = layout.columns.hdRef;
  const loanCol = layout.columns.loanNo;
  for (let r = layout.firstDataRow; r <= layout.rows.length; r += 1) {
    if (deal.hdRef && hdCol != null && cellAt(r, hdCol) === norm(deal.hdRef)) return r;
    if (deal.loanNo && loanCol != null && cellAt(r, loanCol) === norm(deal.loanNo)) return r;
  }

  // 3. Next empty numbered row (Last Name blank). Fall back to the row after
  //    the last populated one if every pre-numbered row is full.
  for (let r = layout.firstDataRow; r <= layout.rows.length + 1; r += 1) {
    if (cellAt(r, lastNameCol) === '') return r;
  }
  return layout.rows.length + 1;
}

// --- Public API ------------------------------------------------------------

export interface JournalDeal {
  lastName: string;
  firstName: string;
  hdReference: string | null; // → "HD Ref #"
  financeItNumber: string | null; // → "Loan #"
  hdStoreLabel: string | null; // → "HD Store" (e.g. "BARRIE - 7024")
  dealerName: string | null; // → "Location" column (column O)
  salesperson: string | null; // → journal "Dealer's Name"
  installer: string | null;
  products: string | null; // comma-joined product names → "Product Sold"
  soap: string | null; // "Yes" / "No" → "SOAP Included"
  payCode: string | null; // "How They Payed" code (HDFINIT / CCHD / …) → column F
  financedAmount: string | null;
  cashAmount: string | null; // non-financed portion → "Cash/Chq /CC Amount" (col J)
  term: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  phone: string | null;
  dealDate: string | null;
  dateInstalled: string | null;
  dateOfSale: string | null;
  saleDate: Date; // used to pick the month tab
  knownTab: string | null;
  knownRow: number | null;
}

export interface JournalResult {
  tab: string;
  row: number;
  wrote: string[]; // field keys written
}

/**
 * Write (or update) a deal's row in the sales journal. Returns the tab + row so
 * the caller can persist them for next time.
 */
export async function writeDealToJournal(deal: JournalDeal): Promise<JournalResult> {
  const sheets = await sheetsClient();
  // Pick the target journal by the deal's SALE year (in live mode); the test
  // journal is a single sandbox for every year.
  const ssId = await resolveWriteSheetId(deal.saleDate.getUTCFullYear());

  // Resolve the month tab from the sale date.
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: ssId,
    fields: 'sheets.properties.title',
  });
  const titles = (meta.data.sheets || [])
    .map((s) => s.properties?.title || '')
    .filter(Boolean);
  const tab = matchTab(titles, deal.saleDate);
  if (!tab) {
    const wanted = `${MONTHS[deal.saleDate.getUTCMonth()]} ${deal.saleDate.getUTCFullYear()}`;
    throw new Error(`No journal tab found for ${wanted}. Tabs present: ${titles.join(', ')}.`);
  }

  const layout = await readLayout(sheets, tab, ssId);
  const row = chooseRow(layout, {
    lastName: deal.lastName,
    hdRef: deal.hdReference,
    loanNo: deal.financeItNumber,
    knownRow: deal.knownTab === tab ? deal.knownRow : null,
  });

  // Map field keys → values. Only defined, non-empty values are written, so we
  // never blank out a cell a human may have filled.
  const values: Record<string, string | null> = {
    lastName: deal.lastName,
    firstName: deal.firstName,
    hdRef: deal.hdReference,
    loanNo: deal.financeItNumber,
    hdStore: deal.hdStoreLabel,
    location: deal.dealerName,
    salesperson: deal.salesperson,
    installer: deal.installer,
    products: deal.products,
    soap: deal.soap,
    payCode: deal.payCode,
    financedAmount: deal.financedAmount,
    cashAmount: deal.cashAmount,
    term: deal.term,
    address: deal.address,
    city: deal.city,
    prov: deal.province,
    postal: deal.postalCode,
    phone: deal.phone,
    dealDate: deal.dealDate,
    dateInstalled: deal.dateInstalled,
    dateOfSale: deal.dateOfSale,
  };

  const data: sheets_v4.Schema$ValueRange[] = [];
  const wrote: string[] = [];
  for (const [key, colIdx] of Object.entries(layout.columns)) {
    const v = values[key];
    if (v == null || v === '') continue;
    data.push({ range: `'${tab}'!${colLetter(colIdx)}${row}`, values: [[v]] });
    wrote.push(key);
  }

  if (data.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: ssId,
      requestBody: { valueInputOption: 'USER_ENTERED', data },
    });
  }

  return { tab, row, wrote };
}

// --- Read-back (journal → portal) ------------------------------------------

/**
 * Locate the read-back columns (Last Name / Result / Date Paid) from a tab's
 * two-row header. Pure + exported so the tricky "two Date Paid columns" case is
 * unit-testable.
 *
 * The journal carries TWO columns headed "Date Paid": one in the AMEX group
 * (usually blank) and the deal-settlement one that sits right after "Result"
 * (the green column the office fills). We must read the settlement one — so we
 * prefer the first "Date Paid" at or after the Result column, and only fall back
 * to the earliest match when there's no Result column to anchor on.
 */
export function locateStatusColumns(top: string[], bottom: string[]): {
  lastNameCol: number;
  resultCol: number;
  paidCol: number;
} {
  const width = Math.max(top.length, bottom.length);
  const combinedAt = (c: number) => norm(`${top[c] ?? ''} ${bottom[c] ?? ''}`);
  const bottomAt = (c: number) => norm(bottom[c]);

  let lastNameCol = -1;
  let resultCol = -1;
  const paidCols: number[] = [];
  for (let c = 0; c < width; c += 1) {
    const b = bottomAt(c);
    const combined = combinedAt(c);
    if (lastNameCol < 0 && b === 'last name') lastNameCol = c;
    if (resultCol < 0 && (b === 'result' || combined.includes('result'))) resultCol = c;
    if (b.includes('paid') || combined.includes('date paid')) paidCols.push(c);
  }

  let paidCol = -1;
  if (resultCol >= 0) paidCol = paidCols.find((c) => c >= resultCol) ?? -1;
  if (paidCol < 0) paidCol = paidCols.length ? paidCols[paidCols.length - 1] : -1;

  return { lastNameCol, resultCol, paidCol };
}

export interface JournalStatusRead {
  found: boolean; // we located the header + row
  lastNameMatches: boolean; // the row's Last Name still matches this deal
  result: string | null; // raw Result cell (e.g. "OK", "PE/OK", "RB")
  isOk: boolean; // Result reads as confirmed/paid-eligible "OK"
  datePaid: Date | null; // the journal's Date Paid, if present
  error?: string;
}

/**
 * Read a deal's CURRENT settlement status back from its journal row — the
 * reverse of writeDealToJournal. Reads the same sheet the write targets (test or
 * live, by sale year) at the remembered tab + row, and returns the Result and
 * Date Paid. Validates the row's Last Name so a shifted/re-used row is caught
 * (lastNameMatches=false) rather than trusted. Best-effort: any failure returns
 * found=false with an error, never throws.
 */
export async function readDealJournalStatus(deal: {
  knownTab: string | null;
  knownRow: number | null;
  lastName: string;
  saleYear: number;
}): Promise<JournalStatusRead> {
  const miss = (error?: string): JournalStatusRead => ({ found: false, lastNameMatches: false, result: null, isOk: false, datePaid: null, error });
  if (!deal.knownTab || !deal.knownRow) return miss('not written to the journal');
  try {
    const sheets = await sheetsClient();
    const ssId = await resolveWriteSheetId(deal.saleYear);
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: ssId,
      range: `'${deal.knownTab}'!A1:BZ${Math.max(deal.knownRow, 60)}`,
      valueRenderOption: 'FORMATTED_VALUE',
    });
    const rows: string[][] = (res.data.values as string[][]) || [];

    // Anchor on the two-row header ("No." + "Last Name"), same as the writer.
    let headerBottom = -1;
    for (let r = 0; r < rows.length; r += 1) {
      const row = rows[r] || [];
      if (norm(row[0]) === 'no' && row.some((c) => norm(c) === 'last name')) {
        headerBottom = r;
        break;
      }
    }
    if (headerBottom < 0) return miss('header row not found');
    const top = rows[headerBottom - 1] || [];
    const bottom = rows[headerBottom] || [];
    const { lastNameCol, resultCol, paidCol } = locateStatusColumns(top, bottom);

    const target = rows[deal.knownRow - 1] || [];
    const cell = (col: number) => (col >= 0 ? String(target[col] ?? '').trim() : '');

    const rowLastName = norm(cell(lastNameCol));
    const lastNameMatches = rowLastName !== '' && rowLastName === norm(deal.lastName);

    const resultRaw = cell(resultCol);
    const rn = norm(resultRaw);
    const isOk = /\bok\b/.test(rn) && !rn.includes('pe'); // "OK" but not "PE/OK"

    const paidRaw = cell(paidCol);
    const parsed = paidRaw ? parseFlexibleDate(paidRaw, deal.saleYear) : null;
    const datePaid = parsed && !isNaN(parsed.getTime()) ? parsed : null;

    return { found: true, lastNameMatches, result: resultRaw || null, isOk, datePaid };
  } catch (e) {
    return miss((e as Error).message);
  }
}

// --- Targeted customer-detail edit (phone / address) -----------------------

export interface JournalCellEdit {
  phone?: string | null;
  address?: string | null;
}

export interface JournalCellEditResult {
  wrote: string[]; // which fields were written
  error?: string;
}

/**
 * Update just a customer's contact cells (phone / address) on an existing
 * journal row, without touching anything else. Used by the customer-search
 * "edit info" flow to keep a customer's details current. Safety: we re-read the
 * row's Last Name and refuse to write if it no longer matches the customer we
 * looked up (the row may have shifted), so we never overwrite the wrong person.
 * Only writes columns the tab actually has, and never blanks a value.
 */
export async function updateJournalRowCells(
  year: number,
  tab: string,
  row: number,
  edit: JournalCellEdit,
  expectLastName: string,
): Promise<JournalCellEditResult> {
  const sheets = await sheetsClient();
  const ssId = await resolveWriteSheetId(year);
  const layout = await readLayout(sheets, tab, ssId);

  // Guard: the target row's Last Name must still match who we think it is.
  const target = layout.rows[row - 1] || [];
  const lastNameCol = layout.columns['lastName'];
  const rowLastName = lastNameCol != null ? norm(target[lastNameCol]) : '';
  if (!rowLastName || rowLastName !== norm(expectLastName)) {
    return { wrote: [], error: 'This journal row no longer matches this customer (it may have moved). Reload the search and try again.' };
  }

  const updates: { key: string; value: string }[] = [];
  if (edit.phone != null && edit.phone.trim()) updates.push({ key: 'phone', value: edit.phone.trim() });
  if (edit.address != null && edit.address.trim()) updates.push({ key: 'address', value: edit.address.trim() });

  const data: sheets_v4.Schema$ValueRange[] = [];
  const wrote: string[] = [];
  const missing: string[] = [];
  for (const u of updates) {
    const col = layout.columns[u.key];
    if (col == null) {
      missing.push(u.key);
      continue;
    }
    data.push({ range: `'${tab}'!${colLetter(col)}${row}`, values: [[u.value]] });
    wrote.push(u.key);
  }

  if (data.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: ssId,
      requestBody: { valueInputOption: 'USER_ENTERED', data },
    });
  }

  return {
    wrote,
    error: missing.length ? `This journal has no ${missing.join(' / ')} column, so that field wasn’t saved to the sheet.` : undefined,
  };
}

/**
 * Cheap connectivity check for an admin "Test journal" button: confirm we can
 * authenticate and read the spreadsheet's tab list. Returns the tab titles.
 */
export async function journalPing(): Promise<{ title: string; tabs: string[] }> {
  const sheets = await sheetsClient();
  const ssId = await resolveWriteSheetId(new Date().getFullYear());
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: ssId,
    fields: 'properties.title,sheets.properties.title',
  });
  return {
    title: meta.data.properties?.title || '(untitled)',
    tabs: (meta.data.sheets || []).map((s) => s.properties?.title || '').filter(Boolean),
  };
}

/**
 * Describe the current WRITE target (for the admin journal-connection screen):
 * the mode, the resolved spreadsheet id, and its live title. Read-only.
 */
export async function journalWriteTarget(year: number = new Date().getFullYear()): Promise<{
  mode: 'test' | 'live';
  year: number;
  sheetId: string | null;
  title: string | null;
  error?: string;
}> {
  const { getJournalWriteMode } = await import('./settings');
  const mode = await getJournalWriteMode();
  let ssId: string | null = null;
  try {
    ssId = await resolveWriteSheetId(year);
  } catch (e) {
    return { mode, year, sheetId: null, title: null, error: (e as Error).message };
  }
  try {
    const sheets = await sheetsClient();
    const meta = await sheets.spreadsheets.get({ spreadsheetId: ssId, fields: 'properties.title' });
    return { mode, year, sheetId: ssId, title: meta.data.properties?.title || '(untitled)' };
  } catch (e) {
    return { mode, year, sheetId: ssId, title: null, error: (e as Error).message };
  }
}
