import 'server-only';
import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';

/** One archived past-journal deal, reduced to what the dealer search shows. */
export interface ArchiveMatch {
  id: string;
  customerName: string;
  phone: string;
  address: string;
  product: string;
  hdStore: string;
  result: string;
  finance: string;
  amount: string; // formatted, or ''
  saleDate: string; // yyyy-mm-dd or ''
  year: number;
}

const money = (n: number) => `$${Math.round(n).toLocaleString('en-CA')}`;

/**
 * Search a dealer's OWN office's archived past-journal customers by name or
 * phone. Strictly scoped to the passed dealerId — a dealer never sees another
 * office's rows. Read-only. Returns [] when the office id is missing.
 */
export async function searchOfficeJournalArchive(dealerId: string | null | undefined, query: string): Promise<ArchiveMatch[]> {
  if (!dealerId) return [];
  const q = query.trim();
  if (q.length < 3) return [];

  const digits = q.replace(/\D/g, '');
  const isPhone = digits.length >= 7;

  const where: Prisma.JournalRecordWhereInput = { dealerId };
  if (isPhone) {
    where.phone = { contains: digits.slice(-10) };
  } else {
    const terms = q.split(/\s+/).filter(Boolean).slice(0, 4);
    where.AND = terms.map((t) => ({ customerName: { contains: t, mode: 'insensitive' as const } }));
  }

  const rows = await prisma.journalRecord.findMany({
    where,
    orderBy: [{ saleDate: 'desc' }, { year: 'desc' }],
    take: 25,
  });

  return rows.map((r) => ({
    id: r.id,
    customerName: r.customerName || `${r.firstName} ${r.lastName}`.trim() || '(no name)',
    phone: r.phone,
    address: r.address,
    product: r.product,
    hdStore: r.hdStore,
    result: r.result,
    finance: r.financeBucket && r.financeBucket !== 'Unknown' ? r.financeBucket : '',
    amount: r.gross != null && Number(r.gross) > 0 ? money(Number(r.gross)) : '',
    saleDate: r.saleDate ? r.saleDate.toISOString().slice(0, 10) : '',
    year: r.year,
  }));
}
