import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import { parseHdRemittanceText, ingestRemittance } from '@/lib/hdRemittance';

/**
 * End-to-end funding accuracy against a real database: parse the real remittance
 * text, ingest it, and prove every deal is funded with ITS OWN amount, the lead
 * fee is netted, and the integrity guard refuses a mismatched total. Skipped
 * unless DATABASE_URL is set.
 */
const RUN = !!process.env.DATABASE_URL;

const REAL = [
  'SEPT26LEADFEES31 10/16/2026 DeductionSept26leadfees 490.00- 0.00 490.00-',
  '701812650 10/23/2026 338.81 0.00 338.81',
  '800256358 10/23/2026 2,146.96 0.00 2,146.96',
  '800257092 10/23/2026 8,704.19 0.00 8,704.19',
  '800256982 10/23/2026 3,112.18 0.00 3,112.18',
  '800257127 10/23/2026 4,916.34 0.00 4,916.34',
  '800257099 10/23/2026 6,900.93 0.00 6,900.93',
  '800256701 10/23/2026 8,289.69 0.00 8,289.69',
  'Document Number/Numèro de Document: 2000160840',
  'Payment Date/Date de Paiement: 10/27/2026',
  '33,919.10 0.00 33,919.10',
].join('\n');

const TRUTH: Record<string, number> = {
  '701812650': 338.81, '800256358': 2146.96, '800257092': 8704.19, '800256982': 3112.18,
  '800257127': 4916.34, '800257099': 6900.93, '800256701': 8289.69,
};

describe.skipIf(!RUN)('HD remittance ingest — funding accuracy', () => {
  let dealerId: string;
  let userId: string;

  beforeAll(async () => {
    const d = await prisma.dealer.create({ data: { name: 'GWA Remit Test Office' } });
    dealerId = d.id;
    const u = await prisma.user.create({ data: { email: 'remit-admin@example.com', name: 'Remit Admin', passwordHash: 'x', role: 'ADMIN', dealerId } });
    userId = u.id;
    // One deal per HD invoice, keyed by hdReference.
    for (const [hd, amt] of Object.entries(TRUTH)) {
      await prisma.application.create({
        data: {
          dealerId, createdById: userId, hdReference: hd, status: 'SUBMITTED',
          programType: 'HD', programCategory: 'WATER', province: 'ON',
          requestedAmount: amt * 1.3, approvedAmount: amt * 1.3,
          applicantFirstName: 'Test', applicantLastName: hd, applicantEmail: `${hd}@example.com`, applicantPhone: '5555555555',
        },
      });
    }
  });

  afterAll(async () => {
    await prisma.hdRemittanceLine.deleteMany({ where: { remittance: { documentNumber: '2000160840' } } }).catch(() => {});
    await prisma.hdRemittance.deleteMany({ where: { documentNumber: '2000160840' } }).catch(() => {});
    await prisma.statusEvent.deleteMany({ where: { application: { dealerId } } }).catch(() => {});
    await prisma.note.deleteMany({ where: { application: { dealerId } } }).catch(() => {});
    await prisma.application.deleteMany({ where: { dealerId } }).catch(() => {});
    await prisma.auditLog.deleteMany({ where: { actorId: userId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { dealerId } }).catch(() => {});
    await prisma.dealer.delete({ where: { id: dealerId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it('funds every deal with ITS OWN amount, nets the fee, records the deduction', async () => {
    const parsed = parseHdRemittanceText(REAL);
    const res = await ingestRemittance({
      documentNumber: parsed.documentNumber, documentDate: parsed.documentDate, paymentDate: parsed.paymentDate,
      source: 'MANUAL', processedById: userId, lines: parsed.lines, grandTotal: parsed.grandTotal,
    });
    expect(res.ok).toBe(true);
    expect(res.funded).toBe(7);
    expect(res.deductions).toBe(1);

    // Each line stored the correct amount against the correct HD deal.
    const lines = await prisma.hdRemittanceLine.findMany({ where: { remittanceId: res.remittanceId! } });
    for (const [hd, amt] of Object.entries(TRUTH)) {
      const line = lines.find((l) => l.hdIdNumber === hd)!;
      expect(Number(line.amount)).toBeCloseTo(amt, 2);
      expect(line.status).toBe('MATCHED');
      const app = await prisma.application.findFirst({ where: { hdReference: hd } });
      expect(app!.status).toBe('FUNDED');
    }

    // The fee is recorded as a negative deduction, and the net reconciles.
    const fee = lines.find((l) => l.status === 'DEDUCTION')!;
    expect(Number(fee.amount)).toBeCloseTo(-490.0, 2);
    const remit = await prisma.hdRemittance.findUnique({ where: { id: res.remittanceId! } });
    expect(Number(remit!.totalNet)).toBeCloseTo(33919.10, 2);
  });

  it('REFUSES to fund when the lines do not add up to HD’s grand total', async () => {
    const parsed = parseHdRemittanceText(REAL);
    const res = await ingestRemittance({
      documentNumber: 'INTEGRITY-TEST-1', source: 'MANUAL', processedById: userId,
      lines: parsed.lines, grandTotal: 99999.99, // deliberately wrong
    });
    expect(res.ok).toBe(false);
    expect(res.error || '').toMatch(/integrity check failed/i);
    // Nothing was written for the bad doc number.
    const remit = await prisma.hdRemittance.findUnique({ where: { documentNumber: 'INTEGRITY-TEST-1' } });
    expect(remit).toBeNull();
  });
});
