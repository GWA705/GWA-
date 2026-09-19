import 'server-only';
import { prisma } from '../db';

/**
 * Mail-in (HD Mail In Test) lead reporting for BILLING. Each scanned card is
 * flagged `uploadedByGwa` at upload time: true when Georgian Water staff uploaded
 * it (a lead mailed to our office → billable to the owning office), false when the
 * office scanned its own mailed-in cards (not billed). This module aggregates the
 * cards per office and splits billable vs office-uploaded.
 *
 * Admin-only surface — never exposed to a dealer/office view.
 */

export interface MailInOfficeRow {
  dealerId: string | null;
  officeName: string;
  billable: number; // uploadedByGwa = true  (Georgian Water uploaded → bill this office)
  officeUploaded: number; // uploadedByGwa = false (office uploaded its own → not billed)
  total: number;
}

export interface MailInReport {
  from: Date | null;
  to: Date | null;
  rows: MailInOfficeRow[]; // offices with any activity, billable-heavy first
  totals: { billable: number; officeUploaded: number; total: number };
}

/**
 * Per-office mail-in counts for a date window (by upload/createdAt). Omit the
 * window for all-time. Rows include an "Unassigned" bucket for GW-uploaded cards
 * whose store didn't map to an office yet (still billable once assigned).
 */
export async function mailInLeadsReport(opts: { from?: Date | null; to?: Date | null } = {}): Promise<MailInReport> {
  const where: { createdAt?: { gte?: Date; lt?: Date } } = {};
  if (opts.from || opts.to) {
    where.createdAt = {};
    if (opts.from) where.createdAt.gte = opts.from;
    if (opts.to) where.createdAt.lt = opts.to;
  }

  const grouped = await prisma.scannedLead.groupBy({
    by: ['dealerId', 'uploadedByGwa'],
    where,
    _count: { _all: true },
  });

  const dealerIds = [...new Set(grouped.map((g) => g.dealerId).filter((x): x is string => !!x))];
  const dealers = dealerIds.length
    ? await prisma.dealer.findMany({ where: { id: { in: dealerIds } }, select: { id: true, name: true } })
    : [];
  const nameById = new Map(dealers.map((d) => [d.id, d.name] as const));

  const byOffice = new Map<string, MailInOfficeRow>();
  for (const g of grouped) {
    const key = g.dealerId ?? '__unassigned__';
    const row =
      byOffice.get(key) ??
      {
        dealerId: g.dealerId,
        officeName: g.dealerId ? nameById.get(g.dealerId) ?? 'Unknown office' : 'Unassigned (no office matched)',
        billable: 0,
        officeUploaded: 0,
        total: 0,
      };
    const n = g._count._all;
    if (g.uploadedByGwa) row.billable += n;
    else row.officeUploaded += n;
    row.total += n;
    byOffice.set(key, row);
  }

  const rows = [...byOffice.values()].sort((a, b) => b.billable - a.billable || b.total - a.total);
  const totals = rows.reduce(
    (t, r) => ({ billable: t.billable + r.billable, officeUploaded: t.officeUploaded + r.officeUploaded, total: t.total + r.total }),
    { billable: 0, officeUploaded: 0, total: 0 },
  );
  return { from: opts.from ?? null, to: opts.to ?? null, rows, totals };
}

/** Parse a 'YYYY-MM' month key into a [from, to) window (UTC). Null for 'all'. */
export function monthWindow(monthKey: string | null | undefined): { from: Date | null; to: Date | null } {
  if (!monthKey || monthKey === 'all') return { from: null, to: null };
  const m = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!m) return { from: null, to: null };
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  return { from: new Date(Date.UTC(y, mo, 1)), to: new Date(Date.UTC(y, mo + 1, 1)) };
}

/** The last N month keys (newest first), e.g. ['2026-09','2026-08',...], for the picker. */
export function recentMonthKeys(n = 12, now: Date = new Date()): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push({
      value: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('en-CA', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    });
  }
  return out;
}
