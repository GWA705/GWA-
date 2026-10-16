/**
 * One-time (idempotent) backfill: stamp the shared HD Leads Log's deal column
 * (U) from the portal's own historical call log, so Home Depot leads that were
 * sold or booked here before the sync existed get written back for the booking
 * system to stop offering them for a call.
 *
 *     npx tsx scripts/backfill-hd-deals.ts           # report only (safe)
 *     npx tsx scripts/backfill-hd-deals.ts --apply   # write column U
 *
 * A lead with any SOLD call is marked Sold; otherwise any BOOKED call → Booked.
 * No Good already lives in column O and needs no backfill. Safe to run more than
 * once (writing the same value is a no-op).
 *
 * After this, run the booking repo's `npm run backfill:portal-resolved --apply`
 * to close the matching leads already on its calling board.
 *
 * Needs the leads-sheet service account with EDITOR access (same as the No-Good
 * write-back) and the database connection.
 */
import { PrismaClient } from '@prisma/client';
import { readLeads, parseLeadRowId, findLeadByBooking } from '../src/lib/leads';
import { writeLeadDeal } from '../src/lib/leadsWrite';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

async function main() {
  // HD leads are keyed `b:<bookingId>`; gather every one ever sold or booked.
  const calls = await prisma.leadCall.findMany({
    where: { leadKey: { startsWith: 'b:' }, outcome: { in: ['SOLD', 'BOOKED'] } },
    select: { leadKey: true, outcome: true },
  });

  const deal = new Map<string, 'sold' | 'booked'>(); // bookingId → coarse (sold wins)
  for (const c of calls) {
    const bookingId = c.leadKey.slice(2).trim();
    if (!bookingId) continue;
    if (deal.get(bookingId) === 'sold') continue; // a sale always wins over a booking
    deal.set(bookingId, c.outcome === 'SOLD' ? 'sold' : 'booked');
  }

  console.log(`${APPLY ? 'APPLY' : 'DRY RUN (use --apply to write)'}`);
  console.log(`HD leads sold / booked in the portal: ${deal.size}\n`);

  const { leads } = await readLeads();
  let wrote = 0;
  let notFound = 0;

  for (const [bookingId, coarse] of deal) {
    const lead = findLeadByBooking(leads, bookingId);
    const parsed = lead ? parseLeadRowId(lead.rowId) : null;
    if (!parsed) { notFound += 1; continue; }
    console.log(`${coarse.toUpperCase().padEnd(6)} #${bookingId} → ${parsed.tab} col U`);
    if (APPLY) {
      const r = await writeLeadDeal(parsed.tab, bookingId, coarse);
      if (!r.ok) console.error(`  ! could not write #${bookingId}: ${r.error}`);
      else wrote += 1;
    }
  }

  console.log(`\n${APPLY ? 'Wrote' : 'Would write'} ${wrote} · not found in the sheet ${notFound}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
