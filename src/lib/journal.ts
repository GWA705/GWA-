import { google, type sheets_v4 } from 'googleapis';
import { parseFlexibleDate } from './reporting/journalRead';
import type { JournalWriteMode } from './settings';

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

/**
 * True when a cell carries no REAL content for the purpose of "is this row an
 * available blank line?". Besides a truly empty cell, this treats a formula's
 * zero/placeholder output as empty — the live journal's calculated columns
 * (Net / TAX / Balance / Pay-to-dealer …) render "$0.00", "0", "-" or "$ -" on
 * every pre-numbered blank row, which must NOT make the row look occupied (that
 * bug pushed every new deal below the totals row). Real text ("Clean Air and
 * Water") or a non-zero amount ("481,688.00") is NOT blankish, so notes rows and
 * totals rows are still protected.
 */
function isBlankish(cell: unknown): boolean {
  const raw = String(cell ?? '').trim();
  if (raw === '') return true;
  // Strip currency/grouping/percent/whitespace and a lone dash placeholder.
  const stripped = raw.replace(/[$,%\s]/g, '');
  if (stripped === '' || stripped === '-' || stripped === '–' || stripped === '—') return true;
  const n = Number(stripped);
  return Number.isFinite(n) && n === 0;
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
  // Unit count (column P, top blank / bottom "UNITS") and the deal-result code
  // (column Q, top "Deal" / bottom "Result"). These were previously left to the
  // office to fill by hand; the portal now seeds them on write.
  { key: 'units', test: (_c, b) => b === 'units' },
  { key: 'result', test: (c, b) => c === 'deal result' || b === 'result' },
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
 * Columns that unambiguously mean "a deal occupies this row": the customer's
 * name, the unique reference numbers, and the deal amounts. Whether a
 * pre-numbered line is FREE is decided by looking ONLY at these — never at the
 * journal's calc / legend / status / helper columns (Net, TAX, Balance, the
 * product-code legend, the Province/Tax-rate helper, checkboxes …). Those carry
 * a value on EVERY row ("$0.00", "-", a default, FALSE), and counting them made
 * every blank line look occupied, so deals got appended below the month's totals
 * row. A real deal fills a name + amounts; a totals row fills amounts; a blank
 * pre-numbered line has all of these empty.
 */
const DEAL_OCCUPANCY_KEYS = ['lastName', 'firstName', 'hdRef', 'loanNo', 'cashAmount', 'financedAmount'] as const;

/** True when a row carries actual deal data in a deal column (see above). */
function rowHasDeal(layout: JournalLayout, row1: number): boolean {
  const row = layout.rows[row1 - 1] || [];
  for (const key of DEAL_OCCUPANCY_KEYS) {
    const col = layout.columns[key];
    if (col != null && !isBlankish(row[col])) return true;
  }
  return false;
}

/**
 * The 1-based sheet row of the last row that carries a deal, so the append point
 * is the row right after it. Judged only by the deal columns (see
 * DEAL_OCCUPANCY_KEYS) — the pre-numbered "No." column and the calc/legend/helper
 * columns are ignored, so empty-but-decorated rows never count as occupied.
 */
function lastContentRow(layout: JournalLayout): number {
  let last = layout.headerBottomRow; // never before the header
  for (let r = layout.firstDataRow; r <= layout.rows.length; r += 1) {
    if (rowHasDeal(layout, r)) last = r;
  }
  return last;
}

/**
 * How a deal's row was chosen — drives whether the write fills the whole row or
 * only its blanks, and whether it should happen at all.
 *  - 'own'      → our remembered row (re-sync); write the portal's values.
 *  - 'empty'    → a fresh blank line; write the portal's values.
 *  - 'match'    → an existing row for THIS deal (e.g. a staff member typed it in);
 *                 fill only its BLANK cells, never overwrite, never duplicate.
 *  - 'conflict' → the deal's reference number is already on the sheet but doesn't
 *                 line up (different name, or on several rows); DO NOT write — a
 *                 human reconciles it, so we never corrupt or duplicate a row.
 */
export type RowPlan =
  | { kind: 'own'; row: number }
  | { kind: 'empty'; row: number }
  | { kind: 'match'; row: number }
  | { kind: 'conflict'; row: number; reason: string };

/**
 * Data rows (1-based) whose HD Ref # or Loan # cell equals this deal's. These are
 * unique per deal, so a match means "this exact deal is already on that row"; a
 * notes or totals row has neither, so it can never match.
 */
function rowsMatchingReference(
  layout: JournalLayout,
  deal: { hdRef: string | null; loanNo: string | null },
): number[] {
  const hdCol = layout.columns.hdRef;
  const loanCol = layout.columns.loanNo;
  const hd = norm(deal.hdRef ?? '');
  const loan = norm(deal.loanNo ?? '');
  if (!hd && !loan) return [];
  const out: number[] = [];
  for (let r = layout.firstDataRow; r <= layout.rows.length; r += 1) {
    const row = layout.rows[r - 1] || [];
    const hdHit = !!hd && hdCol != null && norm(row[hdCol]) === hd;
    const loanHit = !!loan && loanCol != null && norm(row[loanCol]) === loan;
    if (hdHit || loanHit) out.push(r);
  }
  return out;
}

/**
 * Decide which row a deal should occupy, and how to write it (see RowPlan).
 *
 * LIVE journal: (1) re-sync our own remembered row when it still holds this
 * customer's last name; (2) DUPLICATE GUARD — if the deal's unique reference
 * number (HD Ref # / Loan #) is already on a row (e.g. a staff member entered it
 * by hand), reuse that row and fill only its blanks (never duplicate, never
 * overwrite); a same-ref-different-name or multi-row situation is a 'conflict'
 * and is left for a human; (3) otherwise write to the first truly-empty line
 * (the pre-numbered blanks that sit above a totals row), else append below all
 * content. A deal, notes, or totals row is never landed on because each carries
 * content in a non-"No." column.
 *
 * TEST journal is the lenient sandbox (reuse remembered row, match by reference,
 * fill the first blank) so repeated test runs stay tidy; it always full-writes.
 */
export function planRow(
  layout: JournalLayout,
  deal: { lastName: string; hdRef: string | null; loanNo: string | null; knownRow: number | null },
  mode: JournalWriteMode,
): RowPlan {
  const lastNameCol = layout.columns.lastName;
  const cellAt = (row1: number, col: number) => norm((layout.rows[row1 - 1] || [])[col]);

  if (mode === 'live') {
    // 1) Our own row — re-sync in place when the remembered row still holds this
    //    customer's last name (proof it's still ours, not something a human replaced).
    if (deal.knownRow && deal.knownRow >= layout.firstDataRow && cellAt(deal.knownRow, lastNameCol) === norm(deal.lastName)) {
      return { kind: 'own', row: deal.knownRow };
    }

    // 2) Duplicate guard — is this deal already on the sheet (typed in manually,
    //    or a prior write we lost track of)? Match ONLY by the unique reference
    //    numbers, so we never mistake a notes/totals row for the deal.
    const refMatches = rowsMatchingReference(layout, deal);
    if (refMatches.length === 1) {
      const r = refMatches[0];
      const existingName = cellAt(r, lastNameCol);
      if (existingName && existingName !== norm(deal.lastName)) {
        const shown = (layout.rows[r - 1] || [])[lastNameCol] ?? '';
        return { kind: 'conflict', row: r, reason: `the reference number is already on row ${r} under a different name ("${shown}")` };
      }
      return { kind: 'match', row: r };
    }
    if (refMatches.length > 1) {
      return { kind: 'conflict', row: refMatches[0], reason: `this deal's reference number is already on ${refMatches.length} rows (${refMatches.join(', ')}) — remove the duplicate first` };
    }

    // 3) No existing row — first line with no DEAL on it (above a totals row),
    //    else append below the last deal. "Free" is judged only by the deal
    //    columns (rowHasDeal): the live journal fills calc/legend/helper columns
    //    down every blank pre-numbered row, and counting those used to push every
    //    new deal below the totals row. A deal or totals row fills name/amounts,
    //    so it still counts as occupied and is never landed on.
    const end = lastContentRow(layout);
    for (let r = layout.firstDataRow; r <= end; r += 1) {
      if (!rowHasDeal(layout, r)) return { kind: 'empty', row: r };
    }
    return { kind: 'empty', row: end + 1 };
  }

  // --- Test sandbox (lenient; always full-write) ---
  if (deal.knownRow && deal.knownRow >= layout.firstDataRow) {
    const existing = cellAt(deal.knownRow, lastNameCol);
    if (existing === '' || existing === norm(deal.lastName)) return { kind: 'own', row: deal.knownRow };
  }
  const hdCol = layout.columns.hdRef;
  const loanCol = layout.columns.loanNo;
  for (let r = layout.firstDataRow; r <= layout.rows.length; r += 1) {
    if (deal.hdRef && hdCol != null && cellAt(r, hdCol) === norm(deal.hdRef)) return { kind: 'own', row: r };
    if (deal.loanNo && loanCol != null && cellAt(r, loanCol) === norm(deal.loanNo)) return { kind: 'own', row: r };
  }
  for (let r = layout.firstDataRow; r <= layout.rows.length + 1; r += 1) {
    if (cellAt(r, lastNameCol) === '') return { kind: 'own', row: r };
  }
  return { kind: 'own', row: layout.rows.length + 1 };
}

/** Back-compat helper: just the 1-based row number (see planRow for the full plan). */
export function chooseRow(
  layout: JournalLayout,
  deal: { lastName: string; hdRef: string | null; loanNo: string | null; knownRow: number | null },
  mode: JournalWriteMode,
): number {
  return planRow(layout, deal, mode).row;
}

// --- Identity match (find a deal's row when the portal never wrote it) -------

/**
 * Find a deal's row within ONE tab's layout by identity — for the paid read-back
 * on deals that were typed straight into the journal by hand, so the portal has
 * no stored row pointer. Deliberately conservative, because the result flips
 * money-adjacent "paid" state:
 *   1. HD Ref # exact — and, when the deal has a last name, the row's Last Name
 *      must match too (so a mistyped HD # landing on another customer can't flip
 *      the wrong deal).
 *   2. Loan # exact — same Last Name guard.
 *   3. Last Name (+ First Name when present) — ONLY when exactly one row matches
 *      and only when `allowNameMatch` is set (the deal's own sale-month tab); a
 *      name is never matched across tabs.
 * Returns the 1-based sheet row, or null when there's no confident match.
 */
export function findRowInLayout(
  layout: JournalLayout,
  deal: { lastName: string; firstName: string; hdRef: string | null; loanNo: string | null },
  allowNameMatch: boolean,
): number | null {
  const hdCol = layout.columns.hdRef;
  const loanCol = layout.columns.loanNo;
  const lnCol = layout.columns.lastName;
  const fnCol = layout.columns.firstName;
  const cell = (r1: number, c?: number) => (c != null && c >= 0 ? norm((layout.rows[r1 - 1] || [])[c]) : '');
  const hd = norm(deal.hdRef ?? '');
  const loan = norm(deal.loanNo ?? '');
  const ln = norm(deal.lastName);
  const fn = norm(deal.firstName);

  // 1 & 2 — a reference match, verified by Last Name when the deal has one.
  for (let r = layout.firstDataRow; r <= layout.rows.length; r += 1) {
    const nameOk = !ln || cell(r, lnCol) === ln;
    if (hd && hdCol != null && cell(r, hdCol) === hd && nameOk) return r;
    if (loan && loanCol != null && cell(r, loanCol) === loan && nameOk) return r;
  }
  // 3 — an unambiguous name match, same-tab only.
  if (allowNameMatch && ln) {
    const hits: number[] = [];
    for (let r = layout.firstDataRow; r <= layout.rows.length; r += 1) {
      if (cell(r, lnCol) === ln && (!fn || cell(r, fnCol) === fn)) hits.push(r);
    }
    if (hits.length === 1) return hits[0];
  }
  return null;
}

/**
 * Locate a deal's row in the LIVE journal by identity (see findRowInLayout).
 * Reads the deal's sale-month tab first; for a deal that carries an HD #/loan #
 * it will also scan the year's other month tabs (a hand-filed deal may sit in a
 * different month), but a name-only deal is matched on its sale-month tab alone.
 * Best-effort — any Sheets failure returns a null match with an error, never
 * throws. Reads the live per-year sheet, independent of the write-mode toggle.
 */
export async function findDealRowByIdentity(deal: {
  saleYear: number;
  when: Date; // sale date (falls back to created date)
  lastName: string;
  firstName: string;
  hdReference: string | null;
  loanNo: string | null;
}): Promise<{ match: { tab: string; row: number } | null; error?: string }> {
  if (!deal.hdReference && !deal.loanNo && !norm(deal.lastName)) return { match: null };
  try {
    const sheets = await sheetsClient();
    const ssId = liveSheetIdForYear(deal.saleYear);
    if (!ssId) return { match: null, error: `No live journal is configured for ${deal.saleYear}.` };
    const meta = await sheets.spreadsheets.get({ spreadsheetId: ssId, fields: 'sheets.properties.title' });
    const titles = (meta.data.sheets || []).map((s) => s.properties?.title || '').filter(Boolean);
    const primary = matchTab(titles, deal.when);
    const order = primary ? [primary, ...titles.filter((t) => t !== primary)] : titles;
    const hasRef = !!(deal.hdReference || deal.loanNo);
    for (const tab of order) {
      const layout = await readLayout(sheets, tab, ssId);
      const row = findRowInLayout(
        layout,
        { lastName: deal.lastName, firstName: deal.firstName, hdRef: deal.hdReference, loanNo: deal.loanNo },
        tab === primary,
      );
      if (row) return { match: { tab, row } };
      // A name-only deal is only matched on its own sale-month tab; stop there.
      if (!hasRef) break;
    }
    return { match: null };
  } catch (e) {
    return { match: null, error: (e as Error).message };
  }
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
  units: string | null; // count of products sold → "UNITS" (column P)
  result: string | null; // deal-result code (e.g. "PE/OK") → "Deal Result" (column Q)
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
  /** How the row was chosen/handled — see RowPlan. */
  outcome: 'created' | 'updated' | 'matched' | 'conflict';
  /** On a 'matched' write: field keys left as-is because the row already had a value. */
  skipped?: string[];
  /** Human-readable note for the UI (e.g. why a conflict was not written). */
  message?: string;
}

/**
 * Write (or update) a deal's row in the sales journal. Returns the tab + row so
 * the caller can persist them for next time.
 */
export async function writeDealToJournal(deal: JournalDeal): Promise<JournalResult> {
  const sheets = await sheetsClient();
  // Pick the target journal by the deal's SALE year (in live mode); the test
  // journal is a single sandbox for every year. The mode also decides row
  // selection: live is strictly append-only (never over existing rows).
  const { getJournalWriteMode } = await import('./settings');
  const mode = await getJournalWriteMode();
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
  const plan = planRow(layout, {
    lastName: deal.lastName,
    hdRef: deal.hdReference,
    loanNo: deal.financeItNumber,
    knownRow: deal.knownTab === tab ? deal.knownRow : null,
  }, mode);

  // A conflict (the deal's reference number is already on the sheet but doesn't
  // line up) is NOT written — report it so a human reconciles, so we never
  // duplicate or corrupt a row.
  if (plan.kind === 'conflict') {
    return {
      tab,
      row: plan.row,
      wrote: [],
      outcome: 'conflict',
      message: `This deal looks like it is already on the journal — ${plan.reason}. Nothing was written, to avoid a duplicate.`,
    };
  }
  const row = plan.row;
  // On a 'match' (an existing row for this deal, e.g. typed by staff) fill ONLY
  // blank cells — never overwrite what a human already entered.
  const fillBlanksOnly = plan.kind === 'match';

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
    units: deal.units,
    result: deal.result,
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
  const skipped: string[] = [];
  for (const [key, colIdx] of Object.entries(layout.columns)) {
    const v = values[key];
    if (v == null || v === '') continue;
    // Never overwrite a human's entry on a matched (pre-existing) row — only fill
    // its blanks. (We also never blank a cell, since empty values are skipped above.)
    if (fillBlanksOnly && norm((layout.rows[row - 1] || [])[colIdx]) !== '') {
      skipped.push(key);
      continue;
    }
    data.push({ range: `'${tab}'!${colLetter(colIdx)}${row}`, values: [[v]] });
    wrote.push(key);
  }

  if (data.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: ssId,
      requestBody: { valueInputOption: 'USER_ENTERED', data },
    });
  }

  const outcome: JournalResult['outcome'] =
    plan.kind === 'own' ? 'updated' : plan.kind === 'match' ? 'matched' : 'created';
  return { tab, row, wrote, outcome, skipped: skipped.length ? skipped : undefined };
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
  // The ACTUAL amount paid to the dealer, read from the "Pay to dealer" column
  // (net of admin fee / tax / reserve — can be less than the HD calculator's
  // estimate). null when the journal has no such column (older tabs).
  payToDealer: number | null;
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
export async function readDealJournalStatus(
  deal: {
    knownTab: string | null;
    knownRow: number | null;
    lastName: string;
    saleYear: number;
  },
  opts?: { liveOnly?: boolean },
): Promise<JournalStatusRead> {
  const miss = (error?: string): JournalStatusRead => ({ found: false, lastNameMatches: false, result: null, isOk: false, datePaid: null, payToDealer: null, error });
  if (!deal.knownTab || !deal.knownRow) return miss('not written to the journal');
  try {
    const sheets = await sheetsClient();
    // "Paid" is a real-money event that only ever happens in the LIVE journal, so
    // the read-back can read the live per-year sheet directly (liveOnly) instead
    // of following the admin test/live write toggle — the same way reporting reads
    // always use the live journals. Without this, leaving the portal in Test mode
    // silently pointed the paid read at the sandbox sheet and nothing ever synced.
    const ssId = opts?.liveOnly ? liveSheetIdForYear(deal.saleYear) : await resolveWriteSheetId(deal.saleYear);
    if (!ssId) return miss(`No live journal is configured for ${deal.saleYear}.`);
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

    // Actual amount paid to the dealer — the "Pay to dealer" column (header-based,
    // so it just works once the column is added; null on tabs that don't have it).
    let payToDealer: number | null = null;
    let payCol = -1;
    // Match whitespace/punctuation-insensitively so "Pay to dealer", "Pay To Dealer",
    // "pay-to-dealer", "Paid to Dealer" etc. all resolve to the same column (AO on
    // the current journals). Collapse to bare alphanumerics before comparing.
    const PAY_KEYS = ['paytodealer', 'paidtodealer', 'paydealer', 'dealerpay', 'dealerpayout'];
    for (let c = 0; c < Math.max(top.length, bottom.length); c += 1) {
      const combined = norm(`${top[c] ?? ''} ${bottom[c] ?? ''}`).replace(/[^a-z0-9]/g, '');
      if (PAY_KEYS.some((k) => combined.includes(k))) { payCol = c; break; }
    }
    if (payCol >= 0) {
      const raw = cell(payCol).replace(/[$,\s]/g, '');
      const n = raw ? Number(raw) : NaN;
      if (Number.isFinite(n) && n > 0) payToDealer = n;
    }

    return { found: true, lastNameMatches, result: resultRaw || null, isOk, datePaid, payToDealer };
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

// --- Re-place a misplaced row ----------------------------------------------

export interface JournalClearResult {
  cleared: number; // how many managed cells were blanked
  error?: string;
}

/**
 * Blank the portal-managed cells on a single journal row (Last Name, First Name,
 * HD Ref #, Loan #, amounts, …) so a deal can be re-placed on the correct line
 * without leaving a duplicate behind. Used by the staff "Move to the correct
 * line" control for deals the old code appended below the totals row.
 *
 * Safety: refuses to touch the row unless its Last Name still matches the deal
 * we expect there, so we never wipe the wrong customer. Never clears column A
 * (the "No." numbering) or any manual workflow column (Result, Date Paid, …) —
 * only the columns this writer owns. Best-effort for the caller to wrap.
 */
export async function clearJournalRow(
  year: number,
  tab: string,
  row: number,
  expectLastName: string,
): Promise<JournalClearResult> {
  const sheets = await sheetsClient();
  const ssId = await resolveWriteSheetId(year);
  const layout = await readLayout(sheets, tab, ssId);

  const lastNameCol = layout.columns['lastName'];
  const target = layout.rows[row - 1] || [];
  const rowLastName = lastNameCol != null ? norm(target[lastNameCol]) : '';
  if (!rowLastName || rowLastName !== norm(expectLastName)) {
    return { cleared: 0, error: 'This journal row no longer matches this customer (it may have moved).' };
  }

  const data: sheets_v4.Schema$ValueRange[] = [];
  for (const colIdx of Object.values(layout.columns)) {
    data.push({ range: `'${tab}'!${colLetter(colIdx)}${row}`, values: [['']] });
  }
  if (data.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: ssId,
      requestBody: { valueInputOption: 'USER_ENTERED', data },
    });
  }
  return { cleared: data.length };
}

// --- Cancellation → journal "RB" writeback ---------------------------------

export interface JournalRbResult {
  ok: boolean;
  error?: string;
}

/**
 * On a confirmed cancellation, mark the deal's journal row Result = "RB" and
 * attach a cell NOTE on that same cell explaining why (reason, who confirmed it,
 * who at the dealer requested it, dated). Best-effort and safety-gated: writes
 * nothing unless the row's Last Name still matches the deal. Never throws.
 */
export async function writeCancellationToJournal(
  deal: { knownTab: string | null; knownRow: number | null; lastName: string; saleYear: number },
  noteText: string,
): Promise<JournalRbResult> {
  if (!deal.knownTab || !deal.knownRow) return { ok: false, error: 'not written to the journal' };
  try {
    const sheets = await sheetsClient();
    const ssId = await resolveWriteSheetId(deal.saleYear);
    const layout = await readLayout(sheets, deal.knownTab, ssId);

    // Safety: only write if the target row still belongs to this customer.
    const target = layout.rows[deal.knownRow - 1] || [];
    const lastNameCol = layout.columns['lastName'];
    const rowLastName = lastNameCol != null ? norm(target[lastNameCol]) : '';
    if (!rowLastName || rowLastName !== norm(deal.lastName)) {
      return { ok: false, error: 'journal row no longer matches this customer' };
    }

    // Find the Result column (header-based), and the tab's numeric sheetId (gid).
    const top = layout.rows[layout.headerBottomRow - 2] || [];
    const bottom = layout.rows[layout.headerBottomRow - 1] || [];
    let resultCol = -1;
    for (let c = 0; c < Math.max(top.length, bottom.length); c += 1) {
      const b = norm(bottom[c]);
      const combined = norm(`${top[c] ?? ''} ${bottom[c] ?? ''}`);
      if (b === 'result' || combined.includes('result')) { resultCol = c; break; }
    }
    if (resultCol < 0) return { ok: false, error: 'no Result column found' };

    const meta = await sheets.spreadsheets.get({ spreadsheetId: ssId, fields: 'sheets(properties(sheetId,title))' });
    const sheetId = (meta.data.sheets || []).find((s) => s.properties?.title === deal.knownTab)?.properties?.sheetId;
    if (sheetId == null) return { ok: false, error: 'sheet tab not found' };

    // 1) Write "RB" into the Result cell.
    await sheets.spreadsheets.values.update({
      spreadsheetId: ssId,
      range: `'${deal.knownTab}'!${colLetter(resultCol)}${deal.knownRow}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [['RB']] },
    });

    // 2) Attach the explanation as a cell NOTE on that same cell.
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: ssId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId,
                startRowIndex: deal.knownRow - 1,
                endRowIndex: deal.knownRow,
                startColumnIndex: resultCol,
                endColumnIndex: resultCol + 1,
              },
              cell: { note: noteText.slice(0, 2000) },
              fields: 'note',
            },
          },
        ],
      },
    });

    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
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
