/**
 * Import closed-year sales journals into the JournalRecord archive table.
 *
 * The old journals (2024, 2025, …) are no longer edited, so we archive them once
 * into the database — dealers can then search their own office's historical Home
 * Depot customers, and it's fast + permanent. Run this once per closed year.
 *
 * Runs where it can reach BOTH the database and Google Sheets — i.e. in
 * production (Render), NOT the dev sandbox. Reads are done via the existing
 * journal reader; office attribution reuses the Dealer Snapshot matcher.
 *
 * Usage (from the repo root, in an environment with DATABASE_URL + Google creds):
 *   npx tsx scripts/import-journals.ts --year=2024,2025 --dry   # preview, no writes
 *   npx tsx scripts/import-journals.ts --year=2024,2025         # write/refresh
 *   npx tsx scripts/import-journals.ts                          # all closed years
 *
 * Idempotent: rows are upserted on (year, tab, rowNum), so re-running refreshes
 * the archive without creating duplicates.
 */
import { prisma } from '../src/lib/db';
import { readJournal, sheetIdFor, EARLIEST_JOURNAL_YEAR } from '../src/lib/reporting/journalRead';
import { buildDealerMatcher } from '../src/lib/reporting/dealerMatch';
import { importJournalYear } from '../src/lib/reporting/journalImport';

function parseArgs() {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const yearArg = args.find((a) => a.startsWith('--year='));
  let years: number[] = [];
  if (yearArg) {
    years = yearArg
      .slice('--year='.length)
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isInteger(n));
  } else {
    // Default: every closed year — EARLIEST_JOURNAL_YEAR .. (current year - 1).
    const lastClosed = new Date().getUTCFullYear() - 1;
    for (let y = EARLIEST_JOURNAL_YEAR; y <= lastClosed; y += 1) years.push(y);
  }
  return { dry, years };
}

async function main() {
  const { dry, years } = parseArgs();
  console.log(`Journal import — years: ${years.join(', ') || '(none)'}${dry ? ' [DRY RUN]' : ''}`);

  const dealers = await prisma.dealer.findMany({
    where: { active: true },
    select: { id: true, name: true, homeDepotStores: { select: { number: true } } },
  });
  const matchDeal = buildDealerMatcher(dealers);
  const nameById = new Map(dealers.map((d) => [d.id, d.name]));

  let grandTotal = 0;
  let grandMatched = 0;

  for (const year of years) {
    if (!sheetIdFor(year)) {
      console.log(`  ${year}: no JOURNAL_SHEET_ID_${year} configured — skipping.`);
      continue;
    }
    const read = await readJournal(year, true);
    if (read.error) {
      console.log(`  ${year}: ERROR — ${read.error}`);
      continue;
    }
    // DRY RUN: preview office attribution without writing anything.
    if (dry) {
      let matched = 0;
      const byDealer = new Map<string, number>();
      for (const d of read.deals) {
        const dealerId = matchDeal(d);
        if (dealerId) {
          matched += 1;
          byDealer.set(dealerId, (byDealer.get(dealerId) ?? 0) + 1);
        }
      }
      grandTotal += read.deals.length;
      grandMatched += matched;
      console.log(
        `  ${year}: ${read.deals.length} rows, ${matched} matched to an office, ${read.deals.length - matched} unmatched. (dry run — nothing written)`,
      );
      const top = [...byDealer.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
      for (const [id, n] of top) console.log(`      ${nameById.get(id) ?? id}: ${n}`);
      continue;
    }

    // WRITE: delegate to the single shared importer (delete + bulk insert).
    const res = await importJournalYear(year);
    if (!res.ok) {
      console.log(`  ${year}: ERROR — ${res.error}`);
      continue;
    }
    grandTotal += res.rows;
    grandMatched += res.matched;
    console.log(`  ${year}: ${res.rows} rows written, ${res.matched} matched to an office, ${res.unmatched} unmatched.`);
  }

  console.log(`Done. ${grandTotal} rows total, ${grandMatched} matched.${dry ? ' (dry run — nothing written)' : ''}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
