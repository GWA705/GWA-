import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import { scannedLeadDedupeKey } from '@/lib/scannedLeadDedupe';

/**
 * Proves the scan-in duplicate block end to end against a real database. It runs
 * the EXACT decision createScannedLeadAction makes on save — compute the key
 * (scannedLeadDedupeKey), look for an existing lead with that key, refuse if
 * found, else create with the key — so a pass here is the real guarantee.
 *
 * Skipped unless DATABASE_URL is set (an ephemeral Postgres with the migrations
 * applied, so ScannedLead.dedupeKey + its backfill exist).
 */
const RUN = !!process.env.DATABASE_URL;

describe.skipIf(!RUN)('scanning a duplicate lead is blocked', () => {
  let dealerId: string;

  // Mirror of the action's save path: returns the lead on success, or the id of
  // the blocking duplicate.
  async function scan(card: { customerName?: string; phone?: string; storeNumber?: string; collectedOn?: string }) {
    const dedupeKey = scannedLeadDedupeKey(card);
    if (dedupeKey) {
      const dup = await prisma.scannedLead.findFirst({ where: { dealerId, dedupeKey }, orderBy: { createdAt: 'asc' }, select: { id: true, customerName: true } });
      if (dup) return { blocked: true as const, byName: dup.customerName };
    }
    const lead = await prisma.scannedLead.create({ data: { dealerId, dedupeKey, ...card } });
    return { blocked: false as const, id: lead.id };
  }

  beforeAll(async () => {
    const d = await prisma.dealer.create({ data: { name: 'Georgian Water and Air - Winnipeg' } });
    dealerId = d.id;
  });
  afterAll(async () => {
    await prisma.scannedLead.deleteMany({ where: { dealerId } }).catch(() => {});
    await prisma.dealer.delete({ where: { id: dealerId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it('1) first scan of a card saves', async () => {
    const r = await scan({ customerName: 'Betty Bray', phone: '(204) 555-1234', storeNumber: '7054', collectedOn: '2026-09-30' });
    expect(r.blocked).toBe(false);
    expect(await prisma.scannedLead.count({ where: { dealerId } })).toBe(1);
  });

  it('2) the SAME card again is blocked — reformatted phone, different name/store', async () => {
    const r = await scan({ customerName: 'B. Bray', phone: '204.555.1234', storeNumber: '7999' });
    expect(r.blocked).toBe(true);
    expect(r.blocked && r.byName).toBe('Betty Bray'); // points at the existing record
    expect(await prisma.scannedLead.count({ where: { dealerId } })).toBe(1); // nothing doubled
  });

  it('3) a genuinely different lead still saves', async () => {
    const r = await scan({ customerName: 'Jagseer Singh', phone: '204 555 9000', storeNumber: '7180' });
    expect(r.blocked).toBe(false);
    expect(await prisma.scannedLead.count({ where: { dealerId } })).toBe(2);
  });

  it('4) a card with no phone dedupes on name + store (store-sensitive)', async () => {
    expect((await scan({ customerName: 'Harvey Maes', storeNumber: '7056' })).blocked).toBe(false);
    expect((await scan({ customerName: '  harvey   maes ', storeNumber: '7056' })).blocked).toBe(true); // spacing/case
    expect((await scan({ customerName: 'Harvey Maes', storeNumber: '7057' })).blocked).toBe(false); // different store
  });

  it('5) a legacy lead (null key) is caught once the migration backfill runs', async () => {
    const legacy = await prisma.scannedLead.create({ data: { dealerId, customerName: 'Diana Di Casmirro', phone: '204-555-2222', storeNumber: '7056', dedupeKey: null } });
    expect(legacy.dedupeKey).toBeNull();
    // The migration's backfill, verbatim:
    await prisma.$executeRawUnsafe(
      `UPDATE "ScannedLead" SET "dedupeKey" = CASE
         WHEN length(regexp_replace(COALESCE(phone,''),'[^0-9]','','g')) >= 7
           THEN 'p:' || RIGHT(regexp_replace(COALESCE(phone,''),'[^0-9]','','g'),10)
         WHEN lower(btrim(regexp_replace(COALESCE("customerName",''),'\\s+',' ','g'))) <> ''
           THEN 'n:' || lower(btrim(regexp_replace(COALESCE("customerName",''),'\\s+',' ','g'))) || '|s:' || btrim(COALESCE("storeNumber",''))
         ELSE NULL END
       WHERE "dedupeKey" IS NULL`,
    );
    const r = await scan({ customerName: 'Diana Di Casmirro', phone: '(204) 555 2222', storeNumber: '7056' });
    expect(r.blocked).toBe(true);
  });
});
