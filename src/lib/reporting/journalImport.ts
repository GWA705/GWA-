import 'server-only';
import { prisma } from '@/lib/db';
import { readJournal, sheetIdFor } from './journalRead';
import { buildDealerMatcher } from './dealerMatch';

/**
 * Upload one closed sales-journal year from Google Sheets into the Postgres
 * `JournalRecord` archive. Once a year is here, office customer search
 * (searchOfficeJournalArchive → customerSearch) reads it straight from the DB —
 * fast and reliable, no live Sheets call per search.
 *
 * DATA-CORRECTNESS is the priority: the journals change layout year to year (the
 * 2024 book especially — metadata block, two-row header, no Location column), so
 * a bad parse must never silently replace good archived data. Two safeguards:
 *   1. previewJournalYear() — a dry read (no write) that surfaces row counts,
 *      office-match rate, skipped tabs, and the parser's data issues, so an admin
 *      verifies BEFORE committing.
 *   2. importJournalYear() guards the replace: because re-sync deletes the year
 *      first, it refuses to overwrite an existing archive when the fresh parse
 *      returns zero rows or a suspiciously small fraction of what's already there
 *      (unless { force: true }).
 *
 * This is the SINGLE import implementation, shared by the CLI
 * (scripts/import-journals.ts) and the in-portal admin buttons (staff → reports →
 * connection). Runs only where BOTH the database and Google Sheets are reachable
 * (production / Render), not the dev sandbox.
 */

// Below this ratio of new-rows / existing-rows, an overwrite is treated as
// suspicious (likely a parse regression) and blocked unless forced.
const SUSPICIOUS_SHRINK_RATIO = 0.5;

export interface ImportYearResult {
  year: number;
  ok: boolean;
  rows: number; // rows written
  matched: number; // rows attributed to an office
  unmatched: number; // rows with no office match
  totalIssues: number; // parser data issues on this year
  blocked?: boolean; // true when the guard stopped an overwrite (use force to proceed)
  error?: string;
}

export interface JournalPreview {
  year: number;
  ok: boolean;
  error?: string;
  rows: number; // rows the parser produced (would be written)
  matched: number;
  unmatched: number;
  existingRows: number; // rows already archived for this year
  tabsProcessed: number;
  tabsSkipped: { tab: string; reason: string }[];
  issues: { type: string; count: number }[]; // grouped, most frequent first
  totalIssues: number;
  wouldShrink: boolean; // overwrite would drop below the suspicious ratio
  sample: SampleRow[]; // first few parsed rows, to eyeball correctness
}

export interface SampleRow {
  tab: string;
  rowNum: number;
  customer: string;
  storeNumber: string | null;
  office: string | null; // matched dealer name, or null
  product: string;
  result: string;
  saleDate: string; // yyyy-mm-dd or ''
  gross: number | null;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

type JournalRecordCreate = {
  year: number;
  tab: string;
  rowNum: number;
  dealerId: string | null;
  location: string;
  customerName: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  hdRef: string;
  hdStore: string;
  storeNumber: string | null;
  product: string;
  result: string;
  financeBucket: string;
  sourceCategory: string;
  saleDate: Date | null;
  datePaid: Date | null;
  gross: number | null;
  net: number | null;
  isHD: boolean;
  isMisc: boolean;
  link: string;
};

/**
 * Force a live read of the source sheet, map each deal to a JournalRecord row and
 * resolve its office. Shared by preview and import so both see identical data.
 */
async function readAndMap(year: number): Promise<
  | { ok: false; error: string }
  | {
      ok: true;
      records: JournalRecordCreate[];
      matched: number;
      officeById: Map<string, string>;
      tabsProcessed: number;
      tabsSkipped: { tab: string; reason: string }[];
      issues: { type: string; count: number }[];
      totalIssues: number;
    }
> {
  if (!sheetIdFor(year)) return { ok: false, error: `No JOURNAL_SHEET_ID_${year} is configured for ${year}.` };

  const read = await readJournal(year, true); // force live Sheets read (bypass cache)
  if (read.error) return { ok: false, error: read.error };

  const dealers = await prisma.dealer.findMany({
    where: { active: true },
    select: { id: true, name: true, homeDepotStores: { select: { number: true } } },
  });
  const matchDeal = buildDealerMatcher(dealers);
  const officeById = new Map(dealers.map((d) => [d.id, d.name]));

  // Safe store-name → store-number resolver, for older books (2024) that record
  // the HD store as a CITY name ("BARRIE") instead of the number ("7024"). Exact,
  // normalized match against the portal's store list only — a name that isn't in
  // the list, or is ambiguous (same name, two numbers), resolves to null and the
  // raw value is kept. No guessing.
  const stores = await prisma.homeDepotStore.findMany({ select: { number: true, name: true } });
  const normStore = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
  const nameToNumber = new Map<string, string | null>(); // null = ambiguous
  for (const s of stores) {
    const key = normStore(s.name ?? '');
    const num = (s.number ?? '').trim();
    if (!key || !num) continue;
    if (nameToNumber.has(key)) {
      if (nameToNumber.get(key) !== num) nameToNumber.set(key, null); // same name, different number → ambiguous
    } else {
      nameToNumber.set(key, num);
    }
  }
  const resolveStoreNumber = (hdStore: string): string | null => {
    const key = normStore(hdStore || '');
    if (!key) return null;
    return nameToNumber.get(key) ?? null; // null when missing or ambiguous
  };

  let matched = 0;
  const records: JournalRecordCreate[] = read.deals.map((d) => {
    const dealerId = matchDeal(d);
    if (dealerId) matched += 1;
    return {
      year,
      tab: d.tab,
      rowNum: d.rowNum,
      dealerId,
      location: d.location || '',
      customerName: `${d.firstName} ${d.lastName}`.trim(),
      firstName: d.firstName || '',
      lastName: d.lastName || '',
      phone: d.phone || '',
      address: d.address || '',
      hdRef: d.hdRef || '',
      hdStore: d.hdStore || '',
      // Prefer the parsed 4-digit number; fall back to resolving a city-name store.
      storeNumber: d.storeNumber || resolveStoreNumber(d.hdStore || ''),
      product: d.product || '',
      result: d.result || '',
      financeBucket: d.financeBucket || '',
      sourceCategory: d.sourceCategory || '',
      saleDate: d.date,
      datePaid: d.datePaid,
      gross: d.gross || null,
      net: d.netToGWA || null,
      isHD: d.isHD,
      isMisc: d.isMisc,
      link: d.linkUrl || '',
    };
  });

  // Group the parser's per-row issues by type, most frequent first.
  const byType = new Map<string, number>();
  for (const iss of read.issues) byType.set(iss.type, (byType.get(iss.type) ?? 0) + 1);
  const issues = [...byType.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);

  return {
    ok: true,
    records,
    matched,
    officeById,
    tabsProcessed: read.tabsProcessed,
    tabsSkipped: read.tabsSkipped,
    issues,
    totalIssues: read.issues.length,
  };
}

/**
 * Dry read of a year — parses live, resolves offices, and reports what WOULD be
 * written, without touching the database. Use it to verify the data is correct
 * before uploading, especially for older books with unusual layouts.
 */
export async function previewJournalYear(year: number): Promise<JournalPreview> {
  const base: JournalPreview = {
    year,
    ok: false,
    rows: 0,
    matched: 0,
    unmatched: 0,
    existingRows: 0,
    tabsProcessed: 0,
    tabsSkipped: [],
    issues: [],
    totalIssues: 0,
    wouldShrink: false,
    sample: [],
  };
  if (year >= new Date().getUTCFullYear()) {
    return { ...base, error: `${year} is the current/live year — it stays a live read and isn’t archived.` };
  }

  const mapped = await readAndMap(year);
  if (!mapped.ok) return { ...base, error: mapped.error };

  const existingRows = await prisma.journalRecord.count({ where: { year } });
  const wouldShrink =
    existingRows > 0 && mapped.records.length < Math.ceil(existingRows * SUSPICIOUS_SHRINK_RATIO);

  const sample: SampleRow[] = mapped.records.slice(0, 8).map((r) => ({
    tab: r.tab,
    rowNum: r.rowNum,
    customer: r.customerName || '(no name)',
    storeNumber: r.storeNumber,
    office: r.dealerId ? mapped.officeById.get(r.dealerId) ?? null : null,
    product: r.product,
    result: r.result,
    saleDate: r.saleDate ? r.saleDate.toISOString().slice(0, 10) : '',
    gross: r.gross,
  }));

  return {
    year,
    ok: true,
    rows: mapped.records.length,
    matched: mapped.matched,
    unmatched: mapped.records.length - mapped.matched,
    existingRows,
    tabsProcessed: mapped.tabsProcessed,
    tabsSkipped: mapped.tabsSkipped,
    issues: mapped.issues,
    totalIssues: mapped.totalIssues,
    wouldShrink,
    sample,
  };
}

/** Import (or re-sync) a single journal year into the archive table. */
export async function importJournalYear(year: number, opts: { force?: boolean } = {}): Promise<ImportYearResult> {
  const base: ImportYearResult = { year, ok: false, rows: 0, matched: 0, unmatched: 0, totalIssues: 0 };
  // The current (and any future) year always stays a LIVE read so it can be
  // adjusted throughout the year — never freeze it into the archive.
  if (year >= new Date().getUTCFullYear()) {
    return { ...base, error: `${year} is the current/live year — it stays a live read and can’t be archived.` };
  }

  const mapped = await readAndMap(year);
  if (!mapped.ok) return { ...base, error: mapped.error };
  const records = mapped.records;

  // Guard: re-sync replaces the year (delete + insert). Don't let a broken parse
  // (a layout change the reader didn't handle, a transient Sheets error) wipe a
  // good archive. Block a zero/suspiciously-small overwrite unless forced.
  const existingRows = await prisma.journalRecord.count({ where: { year } });
  if (existingRows > 0 && !opts.force) {
    const tooSmall = records.length < Math.ceil(existingRows * SUSPICIOUS_SHRINK_RATIO);
    if (records.length === 0 || tooSmall) {
      return {
        ...base,
        blocked: true,
        rows: records.length,
        matched: mapped.matched,
        unmatched: records.length - mapped.matched,
        totalIssues: mapped.totalIssues,
        error:
          `Safety check: the fresh read has ${records.length} rows but ${existingRows} are already archived for ${year}. ` +
          `This looks like a parse problem, so the archive was left untouched. Preview the year, and if the new read is correct, re-run with Force.`,
      };
    }
  }

  // Replace the year atomically: delete the old rows, bulk-insert the new ones.
  await prisma.$transaction([
    prisma.journalRecord.deleteMany({ where: { year } }),
    ...chunk(records, 500).map((c) => prisma.journalRecord.createMany({ data: c })),
  ]);

  return {
    year,
    ok: true,
    rows: records.length,
    matched: mapped.matched,
    unmatched: records.length - mapped.matched,
    totalIssues: mapped.totalIssues,
  };
}

export interface YearArchiveStatus {
  year: number;
  rows: number; // archived rows in the DB for this year
  matched: number; // rows attributed to an office
  lastImportedAt: Date | null; // most recent import time, or null if never
}

/**
 * Per-year archive status for the admin connection page: how many rows are in
 * the DB, how many are attributed to an office, and when the year was last
 * uploaded. Years never imported come back with rows: 0, lastImportedAt: null.
 */
export async function archiveStatus(years: number[]): Promise<YearArchiveStatus[]> {
  if (years.length === 0) return [];
  const [totals, matchedTotals] = await Promise.all([
    prisma.journalRecord.groupBy({
      by: ['year'],
      where: { year: { in: years } },
      _count: { _all: true },
      _max: { importedAt: true },
    }),
    prisma.journalRecord.groupBy({
      by: ['year'],
      where: { year: { in: years }, dealerId: { not: null } },
      _count: { _all: true },
    }),
  ]);
  const matchedByYear = new Map(matchedTotals.map((m) => [m.year, m._count._all]));
  const byYear = new Map(
    totals.map((t) => [t.year, { rows: t._count._all, lastImportedAt: t._max.importedAt ?? null }]),
  );
  return years
    .slice()
    .sort((a, b) => b - a)
    .map((year) => {
      const t = byYear.get(year);
      return {
        year,
        rows: t?.rows ?? 0,
        matched: matchedByYear.get(year) ?? 0,
        lastImportedAt: t?.lastImportedAt ?? null,
      };
    });
}
