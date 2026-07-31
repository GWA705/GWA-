import { google, type sheets_v4 } from 'googleapis';

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

function sheetId(): string {
  const id = process.env.JOURNAL_SHEET_ID;
  if (!id) throw new Error('JOURNAL_SHEET_ID is not set.');
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
  { key: 'loanNo', test: (_c, b) => b === 'loan' || b.startsWith('loan ') },
  { key: 'term', test: (_c, b) => b.startsWith('term') },
  { key: 'financedAmount', test: (c) => c === 'financed amount' },
  // Column O is headed "Location" (top) with a blank bottom row → dealer name.
  // NB: do NOT map the finance company here — the only "Finance Co." header is
  // the bottom half of "Amt. Paid By / Finance Co.", which is a dollar/formula
  // column, so writing a name there breaks the sheet's math.
  { key: 'location', test: (c) => c === 'location' },
  { key: 'leadGenerator', test: (c) => c === 'lead generator' },
  { key: 'salesperson', test: (c) => c === 'dealer s name' }, // journal "Dealer's Name"
  { key: 'installer', test: (c) => c === 'installer s name' },
  { key: 'products', test: (c) => c.includes('product') },
  { key: 'soap', test: (c) => c.includes('soap') },
  // NB: the journal has more than one "Date Paid" column — this grabs the first;
  // verify on a test write and pin it if it's the wrong one.
  { key: 'datePaid', test: (c) => c === 'date paid' },
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
): Promise<JournalLayout> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId(),
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
  leadGenerator: string | null;
  salesperson: string | null; // → journal "Dealer's Name"
  installer: string | null;
  products: string | null; // comma-joined product names → "Product Sold"
  soap: string | null; // "Yes" / "No" → "SOAP Included"
  datePaid: string | null;
  financedAmount: string | null;
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

  // Resolve the month tab from the sale date.
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: sheetId(),
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

  const layout = await readLayout(sheets, tab);
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
    leadGenerator: deal.leadGenerator,
    salesperson: deal.salesperson,
    installer: deal.installer,
    products: deal.products,
    soap: deal.soap,
    datePaid: deal.datePaid,
    financedAmount: deal.financedAmount,
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
      spreadsheetId: sheetId(),
      requestBody: { valueInputOption: 'USER_ENTERED', data },
    });
  }

  return { tab, row, wrote };
}

/**
 * Cheap connectivity check for an admin "Test journal" button: confirm we can
 * authenticate and read the spreadsheet's tab list. Returns the tab titles.
 */
export async function journalPing(): Promise<{ title: string; tabs: string[] }> {
  const sheets = await sheetsClient();
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: sheetId(),
    fields: 'properties.title,sheets.properties.title',
  });
  return {
    title: meta.data.properties?.title || '(untitled)',
    tabs: (meta.data.sheets || []).map((s) => s.properties?.title || '').filter(Boolean),
  };
}
