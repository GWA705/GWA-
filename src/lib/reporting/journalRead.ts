import 'server-only';
import { google, type sheets_v4 } from 'googleapis';

/**
 * Reporting-side reader for the GHS sales journals (2026 + 2025 spreadsheets).
 *
 * This is a faithful TypeScript port of the classification logic in the office's
 * "Weekly Snapshot v8" Google Apps Script, so the portal's numbers tie out to
 * the reports the team already trusts. It READS only — never writes — and is the
 * single money/history source for the reporting area.
 *
 * The journal write path (src/lib/journal.ts) is unrelated and untouched.
 */

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

/** True when we have credentials and at least the current-year journal id. */
export function reportingJournalEnabled(): boolean {
  const hasCreds = Boolean(
    process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
  );
  return hasCreds && Boolean(sheetIdFor(new Date().getUTCFullYear()));
}

/** Resolve the spreadsheet id for a given calendar year from env. */
export function sheetIdFor(year: number): string | null {
  if (year === 2026) return process.env.JOURNAL_SHEET_ID_2026 || process.env.JOURNAL_SHEET_ID || null;
  if (year === 2025) return process.env.JOURNAL_SHEET_ID_2025 || null;
  // 2024 (and any past/future year) is read from JOURNAL_SHEET_ID_<year>. The
  // 2024 book has a different layout (metadata rows, two-row header, no Location
  // column) — the reader handles that automatically; only the id is needed here.
  const generic = process.env[`JOURNAL_SHEET_ID_${year}`];
  return generic || null;
}

/** Earliest calendar year we keep a sales journal for (the old 2024 book). */
export const EARLIEST_JOURNAL_YEAR = 2024;

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

// ---------------------------------------------------------------------------
// Field / value classification (ported verbatim from the Apps Script)
// ---------------------------------------------------------------------------

const FIELD_CANDIDATES: Record<string, string[]> = {
  date: ['date'],
  lastName: ['last name'],
  firstName: ['first name'],
  hdRef: ['hd ref'],
  hdStore: ['hd store'],
  location: ['location'],
  phone: ['phone'],
  address: ['address'],
  city: ['city'],
  units: ['units', '# of units'],
  product: ['sold and any gifts', 'product'],
  result: ['result'],
  datePaid: ['paid'],
  payedType: ['payed', 'how they'],
  financeType: ['who financed', 'type', 'financed co', 'finance co'],
  grossAmount: ["account", "rec'ble", 'sale'],
  netToGWA: ['amt. paid by', 'amt paid by'],
  netSaleAmount: ['net sale'],
  taxAmount: ['tax collected', 'hst'],
  cashAmount: ['cash/chq /cc amount', 'cash/chq/cc'],
};

const FINANCE_NORMALIZE: { match: string[]; bucket: string }[] = [
  { match: ['GHS'], bucket: 'GHSFINIT' },
  {
    match: ['HDFINIT', 'HDFINT', 'HDFINTI', 'FINITHD', 'HDFININIT', 'HDFIINIT', 'HDFNIT', 'HDINIT', 'HD FINIT', 'HDFINIIT'],
    bucket: 'HDFINIT',
  },
  { match: ['HDUEI', 'UEI'], bucket: 'HDUEI' },
  { match: ['HDCC', 'CCHD'], bucket: 'HDCC' },
  { match: ['GOODHOME', 'GOOD HOME'], bucket: 'GoodHome' },
  { match: ['ENERCARE'], bucket: 'Enercare' },
  { match: ['PROJECT'], bucket: 'Project Loan' },
  { match: ['CASH', 'CHEQUE', 'CHQ', 'ETRANSFER', 'E-TRANSFER', 'E TRANSFER'], bucket: 'Cash/Cheque/Etransfer' },
  { match: ['VISA', 'CC'], bucket: 'Credit Card' },
];

const SOURCE_LABEL_MAP: { match: string[]; bucket: string }[] = [
  { match: ['FNR'], bucket: 'FNR (New Recruit)' },
  { match: ['SERVICE', 'SERVCIE', 'SERVCUE'], bucket: 'Service' },
  { match: ['RETEST'], bucket: 'Retest' },
  { match: ['HOMESHOW', 'HOME SHOW'], bucket: 'Home Show' },
  { match: ['OFFICE', 'OFFCIE', 'PERSONAL'], bucket: 'Office/Personal' },
  { match: ['REFERRAL'], bucket: 'Referral' },
  { match: ['NON HD', 'NONHD', 'NON'], bucket: 'Non-HD (Other)' },
  { match: ['GHS'], bucket: 'GHS Direct' },
];

function classifySource(hdRefRaw: unknown): { isHD: boolean; bucket: string } {
  const raw = String(hdRefRaw ?? '').trim();
  const digitsOnly = raw.replace(/[^0-9]/g, '');
  if (raw !== '' && digitsOnly.length >= 6 && digitsOnly.length === raw.replace(/\s/g, '').length) {
    return { isHD: true, bucket: 'HD Program' };
  }
  const upper = raw.toUpperCase();
  for (const entry of SOURCE_LABEL_MAP) {
    for (const m of entry.match) {
      if (upper.indexOf(m) !== -1) return { isHD: false, bucket: entry.bucket };
    }
  }
  return { isHD: false, bucket: 'Other Outside-HD' };
}

function normalizeFinanceCompany(raw: unknown, isHD: boolean): { bucket: string } {
  const upper = String(raw ?? '').trim().toUpperCase();
  if (upper === 'FINIT') return { bucket: isHD ? 'HDFINIT' : 'GHSFINIT' };
  for (const entry of FINANCE_NORMALIZE) {
    for (const m of entry.match) {
      if (upper.indexOf(m) !== -1) return { bucket: entry.bucket };
    }
  }
  return { bucket: upper === '' ? 'Unknown' : 'Other' };
}

function norm(s: unknown): string {
  return String(s ?? '').trim().toLowerCase();
}

export function parseFlexibleDate(value: unknown, fallbackYear: number): Date | null {
  if (value == null || value === '') return null;
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value as unknown as number)) {
    return value as Date;
  }
  const str = String(value).trim();
  if (str === '') return null;
  // Trust the native parser (handles "5/15/26", "May 15, 2026", ISO, etc.), with
  // one correction: when the string carries NO explicit 4-digit year, V8's legacy
  // parser fills a missing year with 2001 (e.g. the 2024 book's "5-Mar" cells).
  // In that one case, use the journal's own year instead of 2001.
  const hasFullYear = /\d{4}/.test(str);
  const native = new Date(str);
  if (!isNaN(native.getTime()) && native.getFullYear() > 2000) {
    if (!hasFullYear && native.getFullYear() === 2001) {
      return new Date(fallbackYear, native.getMonth(), native.getDate());
    }
    return native;
  }
  const m = str.match(/^(\d{1,2})[-\s]([A-Za-z]{3,9})\.?\s?(\d{2,4})?$/);
  if (m) {
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const monthIdx = months.indexOf(m[2].substring(0, 3).toLowerCase());
    if (monthIdx === -1) return null;
    const year = m[3] ? (m[3].length === 2 ? 2000 + parseInt(m[3], 10) : parseInt(m[3], 10)) : fallbackYear;
    return new Date(year, monthIdx, parseInt(m[1], 10));
  }
  return null;
}

function parseMoney(value: unknown): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const n = parseFloat(String(value).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}

// ---------------------------------------------------------------------------
// Header + column mapping
// ---------------------------------------------------------------------------

const MONTHS_FULL = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];
const MONTHS_ABBR = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec'];

/**
 * Is this tab name a month tab? Tolerant of the many ways the offices have named
 * them across years: "March 2026", "Mar 2026", "Mar. 2026", but also the older
 * 2024 journal's bare "MARCH" / "March" / "Mar-24" / "March '24" / "March 24".
 * Anything that isn't a recognizable month word is treated as a non-data tab.
 */
export function isMonthTab(title: string): boolean {
  const t = String(title || '').trim().toLowerCase().replace(/\./g, '');
  if (!t) return false;
  // month word, optionally followed by a 2- or 4-digit year (any/no separator:
  // "march 2026", "mar-24", "march'24", or the dot-stripped "mar2026")
  const m = t.match(/^([a-z]+)(?:[\s\-']*(?:\d{2}|\d{4}))?$/);
  if (!m) return false;
  return MONTHS_FULL.includes(m[1]) || MONTHS_ABBR.includes(m[1]);
}

export function findHeaderRowIndex(data: string[][]): number {
  for (let i = 0; i < Math.min(data.length, 8); i += 1) {
    const rowText = (data[i] || []).join('|').toLowerCase();
    if (rowText.indexOf('result') !== -1 && rowText.indexOf('last name') !== -1) return i;
  }
  return -1;
}

export function buildColumnMap(headerRow: string[], rowAbove: string[]): Record<string, number> {
  const combined = headerRow.map((cell, i) => {
    const above = String((rowAbove && rowAbove[i]) || '').trim();
    const here = String(cell || '').trim();
    return (above + ' ' + here).trim().toLowerCase();
  });
  const map: Record<string, number> = {};
  for (const field of Object.keys(FIELD_CANDIDATES)) {
    map[field] = -1;
    const candidates = FIELD_CANDIDATES[field];
    for (const cand of candidates) {
      for (let i = 0; i < combined.length; i += 1) {
        if (combined[i].indexOf(cand) !== -1) {
          map[field] = i;
          break;
        }
      }
      if (map[field] !== -1) break;
    }
  }
  // Prefer a plain "date" column over paid/installed if the matched one is one of those.
  if (map.date !== -1 && (combined[map.date].indexOf('paid') !== -1 || combined[map.date].indexOf('installed') !== -1)) {
    for (let j = 0; j < combined.length; j += 1) {
      if (combined[j].trim() === 'date') {
        map.date = j;
        break;
      }
    }
  }
  // Date-paid column: the nearest "paid" (not "amt") header at/after the result column.
  if (map.result !== -1) {
    const paidCandidates: number[] = [];
    for (let k = 0; k < combined.length; k += 1) {
      if (combined[k].indexOf('paid') !== -1 && combined[k].indexOf('amt') === -1) paidCandidates.push(k);
    }
    let best = -1;
    for (const p of paidCandidates) {
      if (p >= map.result && (best === -1 || p < best)) best = p;
    }
    if (best === -1 && paidCandidates.length) best = paidCandidates[paidCandidates.length - 1];
    if (best !== -1) map.datePaid = best;
  }
  return map;
}

function rowLink(fileId: string, sheetGid: number, rowNum: number): string {
  return `https://docs.google.com/spreadsheets/d/${fileId}/edit#gid=${sheetGid}&range=A${rowNum}`;
}

/**
 * Some journals (notably the 2024 book) have no "Location" column — instead the
 * office is named in a metadata line above the header, e.g. "Office: GEORGIAN
 * WATER & AIR". Pull that out so office/dealer attribution still works.
 */
export function officeFromMetadata(data: string[][], headerRowIdx: number): string {
  for (let i = 0; i < headerRowIdx; i += 1) {
    for (const cell of data[i] || []) {
      const m = String(cell || '').match(/office\s*:\s*(.+)/i);
      if (m && m[1].trim()) return m[1].trim();
    }
  }
  return '';
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ReportDeal {
  id: string;
  year: number;
  date: Date | null; // sale date
  datePaid: Date | null;
  result: 'OK' | 'PE/OK' | 'RB';
  lastName: string;
  firstName: string;
  hdRef: string; // raw HD reference (800…/701… etc.)
  phone: string;
  address: string;
  hdStore: string; // raw HD store label (e.g. "BARRIE - 7024")
  storeNumber: string | null; // parsed 4-digit HD store number, if present
  location: string; // raw location / dealer label
  product: string;
  isHD: boolean;
  sourceCategory: string;
  financeBucket: string;
  gross: number;
  netToGWA: number;
  linkUrl: string;
}

export type JournalIssueType =
  | 'unrecognized_result'
  | 'unparseable_date'
  | 'unrecognized_source_label'
  | 'unrecognized_financing'
  | 'missing_gross_amount'
  | 'formula_error_in_journal'
  | 'missing_financing_on_confirmed_deal'
  | 'project_loan_without_hd_number';

export interface JournalIssue {
  type: JournalIssueType;
  tab: string;
  row: number;
  customer: string;
  field: string;
  rawValue: string;
  link: string;
}

export interface JournalReadResult {
  year: number;
  deals: ReportDeal[];
  tabsProcessed: number;
  tabsSkipped: { tab: string; reason: string }[];
  issues: JournalIssue[];
  derivedCount: number;
  configured: boolean;
  error?: string;
}

function extractStoreNumber(hdStoreRaw: unknown): string | null {
  const m = String(hdStoreRaw ?? '').match(/(\d{4})/);
  return m ? m[1] : null;
}

// ---------------------------------------------------------------------------
// Reader
// ---------------------------------------------------------------------------

async function readJournalUncached(year: number): Promise<JournalReadResult> {
  const fileId = sheetIdFor(year);
  const empty = (extra: Partial<JournalReadResult> = {}): JournalReadResult => ({
    year,
    deals: [],
    tabsProcessed: 0,
    tabsSkipped: [],
    issues: [],
    derivedCount: 0,
    configured: Boolean(fileId),
    ...extra,
  });
  if (!fileId) return empty();

  let sheets: sheets_v4.Sheets;
  try {
    sheets = await sheetsClient();
  } catch (e) {
    return empty({ error: `Google credentials not available: ${(e as Error).message}` });
  }

  let titles: { title: string; gid: number }[];
  try {
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: fileId,
      fields: 'sheets.properties(title,sheetId)',
    });
    titles = (meta.data.sheets || [])
      .map((s) => ({ title: s.properties?.title || '', gid: s.properties?.sheetId ?? 0 }))
      .filter((s) => s.title);
  } catch (e) {
    return empty({ error: `Could not open the ${year} journal: ${(e as Error).message}` });
  }

  // Primary: tabs whose name reads as a month. If a journal names its tabs some
  // other way (older books did), fall back to scanning EVERY tab — the header
  // detection below quietly skips any tab that isn't a data sheet, so this is
  // safe and just makes the reader tolerant of unusual layouts (e.g. 2024).
  let monthTabs = titles.filter((t) => isMonthTab(t.title));
  if (monthTabs.length === 0) monthTabs = titles;
  if (monthTabs.length === 0) return empty();

  // One batched read for all month tabs.
  const ranges = monthTabs.map((t) => `'${t.title}'!A1:BZ500`);
  let valueRanges: sheets_v4.Schema$ValueRange[] = [];
  try {
    const res = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: fileId,
      ranges,
      valueRenderOption: 'FORMATTED_VALUE',
    });
    valueRanges = res.data.valueRanges || [];
  } catch (e) {
    return empty({ error: `Could not read the ${year} journal tabs: ${(e as Error).message}` });
  }

  const out = empty();
  const issues: JournalIssue[] = out.issues;
  const logIssue = (
    type: JournalIssueType,
    tab: string,
    row: number,
    customer: string,
    field: string,
    rawValue: unknown,
    link: string,
  ) => {
    issues.push({ type, tab, row, customer, field, rawValue: String(rawValue ?? ''), link });
  };

  for (let ti = 0; ti < monthTabs.length; ti += 1) {
    const { title: name, gid } = monthTabs[ti];
    const data = (valueRanges[ti]?.values as string[][]) || [];
    const headerRowIdx = findHeaderRowIndex(data);
    if (headerRowIdx === -1) {
      out.tabsSkipped.push({ tab: name, reason: 'no header row found' });
      continue;
    }
    const rowAbove = headerRowIdx > 0 ? data[headerRowIdx - 1] : [];
    const colMap = buildColumnMap(data[headerRowIdx], rowAbove);
    if (colMap.result === -1 || colMap.date === -1) {
      out.tabsSkipped.push({ tab: name, reason: 'missing Result or Date column' });
      continue;
    }
    out.tabsProcessed += 1;
    // Office/dealer name from the metadata block, used when there's no Location
    // column (the 2024 book). Computed once per tab.
    const officeMeta = officeFromMetadata(data, headerRowIdx);

    for (let r = headerRowIdx + 1; r < data.length; r += 1) {
      const row = data[r] || [];
      const resultRaw = row[colMap.result];
      if (!resultRaw) continue; // blank template row

      const lastName = colMap.lastName !== -1 ? String(row[colMap.lastName] || '') : '';
      const rowNum = r + 1;
      const link = rowLink(fileId, gid, rowNum);

      let result = String(resultRaw).trim().toUpperCase();
      if (result === 'PEOK' || result === 'PE') result = 'PE/OK';
      if (result === 'RD' || result === 'BR' || result === 'TD' || result === 'PE/TD') result = 'RB';
      if (result !== 'OK' && result !== 'PE/OK' && result !== 'RB') {
        logIssue('unrecognized_result', name, rowNum, lastName, 'Result', resultRaw, link);
        continue;
      }

      const saleDate = parseFlexibleDate(row[colMap.date], year);
      if (!saleDate) {
        logIssue('unparseable_date', name, rowNum, lastName, 'Date', row[colMap.date], link);
        continue;
      }

      const hdRefRaw = colMap.hdRef !== -1 ? row[colMap.hdRef] : '';
      const classification = classifySource(hdRefRaw);
      if (classification.bucket === 'Other Outside-HD' && result !== 'RB') {
        logIssue('unrecognized_source_label', name, rowNum, lastName, 'HD Ref #', hdRefRaw, link);
      }

      const financeRaw =
        colMap.payedType !== -1 ? row[colMap.payedType] : colMap.financeType !== -1 ? row[colMap.financeType] : '';
      let finance = normalizeFinanceCompany(financeRaw, classification.isHD);
      if (result !== 'RB') {
        if (finance.bucket === 'Unknown') {
          const cashAmt = colMap.cashAmount !== -1 ? parseMoney(row[colMap.cashAmount]) : 0;
          if (cashAmt > 0) {
            finance = { bucket: 'Cash/Cheque/Etransfer' };
          } else if (result === 'OK') {
            logIssue('missing_financing_on_confirmed_deal', name, rowNum, lastName, 'Financing', financeRaw, link);
          }
        } else if (finance.bucket === 'Other') {
          logIssue('unrecognized_financing', name, rowNum, lastName, 'Financing', financeRaw, link);
        } else if (finance.bucket === 'Project Loan' && !classification.isHD) {
          logIssue('project_loan_without_hd_number', name, rowNum, lastName, 'HD Ref #', hdRefRaw, link);
        }
      }

      // Gross amount, with safe derivation (Net + Tax) fallback.
      const grossCellRaw = colMap.grossAmount !== -1 ? row[colMap.grossAmount] : '';
      const isFormulaError = /^#(N\/A|REF!|VALUE!|DIV\/0!|NAME\?|NULL!)/i.test(String(grossCellRaw || '').trim());
      let gross = colMap.grossAmount !== -1 ? parseMoney(row[colMap.grossAmount]) : 0;
      if (gross <= 0 && result !== 'RB') {
        const netSale = colMap.netSaleAmount !== -1 ? parseMoney(row[colMap.netSaleAmount]) : 0;
        const taxAmt = colMap.taxAmount !== -1 ? parseMoney(row[colMap.taxAmount]) : 0;
        if (netSale > 0) {
          gross = netSale + taxAmt;
          out.derivedCount += 1;
        } else if (isFormulaError) {
          logIssue('formula_error_in_journal', name, rowNum, lastName, 'Account/Gross', grossCellRaw, link);
        } else {
          logIssue('missing_gross_amount', name, rowNum, lastName, 'Account/Gross', grossCellRaw, link);
        }
      }

      const net = colMap.netToGWA !== -1 ? parseMoney(row[colMap.netToGWA]) : 0;
      const datePaid = colMap.datePaid !== -1 ? parseFlexibleDate(row[colMap.datePaid], year) : null;
      const hdStore = colMap.hdStore !== -1 ? String(row[colMap.hdStore] || '') : '';

      out.deals.push({
        id: `${fileId}-${gid}-${r}`,
        year,
        date: saleDate,
        datePaid,
        result: result as ReportDeal['result'],
        lastName,
        firstName: colMap.firstName !== -1 ? String(row[colMap.firstName] || '') : '',
        hdRef: String(hdRefRaw || ''),
        phone: colMap.phone !== -1 ? String(row[colMap.phone] || '') : '',
        address: [colMap.address !== -1 ? row[colMap.address] : '', colMap.city !== -1 ? row[colMap.city] : '']
          .filter(Boolean)
          .join(', '),
        hdStore,
        storeNumber: extractStoreNumber(hdStore),
        location: colMap.location !== -1 ? String(row[colMap.location] || '') : officeMeta,
        product: colMap.product !== -1 ? String(row[colMap.product] || '') : '',
        isHD: classification.isHD,
        sourceCategory: classification.bucket,
        financeBucket: finance.bucket,
        gross,
        netToGWA: net,
        linkUrl: link,
      });
    }
  }

  return out;
}

// --- Simple time-based cache (the journal changes slowly) ------------------

const CACHE_TTL_MS = 5 * 60 * 1000;
const _cache = new Map<number, { at: number; value: JournalReadResult }>();

export async function readJournal(year: number, force = false): Promise<JournalReadResult> {
  const now = Date.now();
  const hit = _cache.get(year);
  if (!force && hit && now - hit.at < CACHE_TTL_MS) return hit.value;
  const value = await readJournalUncached(year);
  // Only cache successful reads; let errors retry next request.
  if (!value.error) _cache.set(year, { at: now, value });
  return value;
}

export function clearJournalCache(): void {
  _cache.clear();
}

// ---------------------------------------------------------------------------
// Connection diagnostics (admin "Test journal connection")
// ---------------------------------------------------------------------------

export interface JournalYearStatus {
  year: number;
  configured: boolean; // an id is set for this year
  ok: boolean; // we could open + read it
  title?: string; // spreadsheet title
  monthTabs?: number; // count of month tabs found
  totalTabs?: number;
  deals?: number; // deals the reader actually parsed out of this book
  error?: string;
}

export interface JournalDiagnostics {
  hasCredentials: boolean;
  serviceAccountEmail: string | null;
  years: JournalYearStatus[];
}

/** The HD leads log spreadsheet id (env), or null when unset. */
export function leadsSheetId(): string | null {
  return process.env.HD_LEADS_SHEET_ID || null;
}

/** Read a single tab's grid (formatted values). Throws on failure. */
export async function readSheetTab(spreadsheetId: string, tab: string, range = 'A1:Z5000'): Promise<string[][]> {
  const sheets = await sheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${tab}'!${range}`,
    valueRenderOption: 'FORMATTED_VALUE',
  });
  return (res.data.values as string[][]) || [];
}

/**
 * Read-only connectivity probe for any Google Sheet: returns its title and tab
 * titles, or an error string. Used by the system-health dashboard.
 */
export async function pingSheet(
  spreadsheetId: string,
): Promise<{ title?: string; tabs?: string[]; error?: string }> {
  try {
    const sheets = await sheetsClient();
    const meta = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'properties.title,sheets.properties.title',
    });
    return {
      title: meta.data.properties?.title || '(untitled)',
      tabs: (meta.data.sheets || []).map((s) => s.properties?.title || '').filter(Boolean),
    };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/**
 * Live connection check used by the admin "Journal connection" page. Reveals the
 * service-account email (so an admin can share the sheets with it) and, for each
 * configured year, whether the sheet can be opened and how many month tabs it
 * has. Bypasses the read cache — always a fresh check.
 */
export async function journalDiagnostics(years: number[]): Promise<JournalDiagnostics> {
  const hasCredentials = Boolean(
    process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
  );
  const out: JournalDiagnostics = { hasCredentials, serviceAccountEmail: null, years: [] };
  if (!hasCredentials) {
    out.years = years.map((year) => ({ year, configured: Boolean(sheetIdFor(year)), ok: false, error: 'No Google credentials configured on the server.' }));
    return out;
  }

  let sheets: sheets_v4.Sheets;
  try {
    sheets = await sheetsClient();
    // Surface the service-account email so admins know who to share sheets with.
    const inline = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (inline) {
      try {
        out.serviceAccountEmail = JSON.parse(inline).client_email ?? null;
      } catch {
        /* ignore */
      }
    }
    if (!out.serviceAccountEmail) {
      const auth = new google.auth.GoogleAuth({ scopes: SCOPES });
      const creds = await auth.getCredentials();
      out.serviceAccountEmail = creds.client_email ?? null;
    }
  } catch (e) {
    out.years = years.map((year) => ({ year, configured: Boolean(sheetIdFor(year)), ok: false, error: `Credentials error: ${(e as Error).message}` }));
    return out;
  }

  for (const year of years) {
    const id = sheetIdFor(year);
    if (!id) {
      out.years.push({ year, configured: false, ok: false });
      continue;
    }
    try {
      const meta = await sheets.spreadsheets.get({
        spreadsheetId: id,
        fields: 'properties.title,sheets.properties.title',
      });
      const titles = (meta.data.sheets || []).map((s) => s.properties?.title || '').filter(Boolean);
      const monthTabs = titles.filter((t) => isMonthTab(t));
      // Actually parse the book so we can show how many deals the reader gets
      // out of it — the definitive check that a different layout is understood.
      let deals: number | undefined;
      try {
        const read = await readJournal(year);
        deals = read.deals.length;
      } catch {
        deals = undefined;
      }
      out.years.push({
        year,
        configured: true,
        ok: true,
        title: meta.data.properties?.title || '(untitled)',
        monthTabs: monthTabs.length,
        totalTabs: titles.length,
        deals,
      });
    } catch (e) {
      out.years.push({ year, configured: true, ok: false, error: (e as Error).message });
    }
  }
  return out;
}
