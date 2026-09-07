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
 * This is the SINGLE import implementation, shared by the CLI
 * (scripts/import-journals.ts) and the in-portal admin "Upload / Re-sync"
 * button (staff → reports → connection). Re-syncing replaces the year: the
 * existing rows for that year are deleted, then the fresh rows are bulk-inserted
 * in one transaction — so a re-import never duplicates and never leaves a
 * half-written year.
 *
 * Runs only where BOTH the database and Google Sheets are reachable (production /
 * Render), not the dev sandbox.
 */

export interface ImportYearResult {
  year: number;
  ok: boolean;
  rows: number; // rows written
  matched: number; // rows attributed to an office
  unmatched: number; // rows with no office match
  error?: string;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Import (or re-sync) a single journal year into the archive table. */
export async function importJournalYear(year: number): Promise<ImportYearResult> {
  const base: ImportYearResult = { year, ok: false, rows: 0, matched: 0, unmatched: 0 };
  // The current (and any future) year always stays a LIVE read so it can be
  // adjusted throughout the year — never freeze it into the archive.
  if (year >= new Date().getUTCFullYear()) {
    return { ...base, error: `${year} is the current/live year — it stays a live read and can’t be archived.` };
  }
  if (!sheetIdFor(year)) {
    return { ...base, error: `No JOURNAL_SHEET_ID_${year} is configured for ${year}.` };
  }

  // Force a live read of the source sheet (bypass the report cache).
  const read = await readJournal(year, true);
  if (read.error) return { ...base, error: read.error };

  const dealers = await prisma.dealer.findMany({
    where: { active: true },
    select: { id: true, name: true, homeDepotStores: { select: { number: true } } },
  });
  const matchDeal = buildDealerMatcher(dealers);

  let matched = 0;
  const records = read.deals.map((d) => {
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
      storeNumber: d.storeNumber,
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

  // Replace the year atomically: delete the old rows, bulk-insert the new ones.
  // Bulk createMany (chunked) is far faster than per-row upsert for a full year.
  await prisma.$transaction([
    prisma.journalRecord.deleteMany({ where: { year } }),
    ...chunk(records, 500).map((c) => prisma.journalRecord.createMany({ data: c })),
  ]);

  return { year, ok: true, rows: records.length, matched, unmatched: records.length - matched };
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
