import 'server-only';
import { prisma } from './db';

/**
 * Normalize a phone to its last 10 digits so the same customer's number matches
 * across formats (e.g. "(705) 555-0148", "705-555-0148", "+17055550148").
 */
export function normalizeCallPhone(raw: string | null | undefined): string {
  const d = (raw ?? '').replace(/\D/g, '');
  return d.length >= 10 ? d.slice(-10) : d;
}

export interface CustomerCallVM {
  id: string;
  note: string;
  loggedBy: string;
  at: string; // preformatted
  forwarded: boolean;
}

export interface CustomerCallSnapshot {
  calls: CustomerCallVM[];
  total: number; // all calls for this customer (not just the shown page)
  forwarded: number; // how many were forwarded to the office
  lastAt: string | null;
}

const fmt = (d: Date) =>
  d.toLocaleString('en-CA', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

/**
 * Load the call log + snapshot for a customer. When we have a phone number the
 * count spans EVERY deal for that same person (normalized match); otherwise it
 * falls back to just this deal. Shows the 100 most recent; counts are exact.
 */
export async function loadCustomerCalls(
  applicationId: string,
  phone: string | null | undefined,
): Promise<CustomerCallSnapshot> {
  const norm = normalizeCallPhone(phone);
  const where = norm ? { customerPhone: norm } : { applicationId };

  const [rows, total, forwarded] = await Promise.all([
    prisma.customerCall.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { loggedBy: { select: { name: true } } },
    }),
    prisma.customerCall.count({ where }),
    prisma.customerCall.count({ where: { ...where, forwardedToOfficeAt: { not: null } } }),
  ]);

  return {
    calls: rows.map((r) => ({
      id: r.id,
      note: r.note,
      loggedBy: r.loggedBy?.name ?? '—',
      at: fmt(r.createdAt),
      forwarded: !!r.forwardedToOfficeAt,
    })),
    total,
    forwarded,
    lastAt: rows[0] ? fmt(rows[0].createdAt) : null,
  };
}
