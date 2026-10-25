import 'server-only';
import { prisma } from '@/lib/db';

/**
 * Admin "Confirmation team" stats — what each internal staff member did over a
 * date range: deals confirmed, issues found, confirmation-call attempts (and how
 * many reached the customer), customer calls logged, and review requests sent
 * (email vs text). Every metric is attributed to the user who did it:
 *   - deals confirmed / issues → Confirmation.confirmedById (+ the deal's status)
 *   - call attempts / reached   → ConfirmationAttempt.createdById
 *   - calls logged              → CustomerCall.loggedById
 *   - review requests           → Application.reviewRequestById (+ via)
 *
 * NOT included: hours worked — the portal has no clock/timesheet.
 */

export interface ConfirmationUserRow {
  userId: string;
  name: string;
  email: string;
  dealsConfirmed: number;
  issues: number;
  callAttempts: number;
  reached: number;
  callsLogged: number;
  reviewEmail: number;
  reviewText: number;
  reviewTotal: number;
}

export type ConfirmationTeamTotals = Omit<ConfirmationUserRow, 'userId' | 'name' | 'email'>;

export interface ConfirmationTeamStats {
  start: Date;
  end: Date;
  rows: ConfirmationUserRow[];
  totals: ConfirmationTeamTotals;
}

function tally(groups: ReadonlyArray<Record<string, unknown>>, key: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const g of groups) {
    const id = g[key];
    const count = (g._count as { _all?: number } | undefined)?._all ?? 0;
    if (typeof id === 'string' && id) m.set(id, (m.get(id) ?? 0) + count);
  }
  return m;
}

export async function buildConfirmationTeamStats(start: Date, end: Date): Promise<ConfirmationTeamStats> {
  const range = { gte: start, lte: end };

  const [users, confirmed, issues, attempts, reached, calls, reviews] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: ['REVIEWER', 'ADMIN'] }, active: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    }),
    prisma.confirmation.groupBy({
      by: ['confirmedById'],
      where: { confirmedById: { not: null }, completedAt: range, application: { confirmationStatus: 'COMPLETED' } },
      _count: { _all: true },
    }),
    prisma.confirmation.groupBy({
      by: ['confirmedById'],
      where: { confirmedById: { not: null }, updatedAt: range, application: { confirmationStatus: 'ISSUE' } },
      _count: { _all: true },
    }),
    prisma.confirmationAttempt.groupBy({
      by: ['createdById'],
      where: { createdById: { not: null }, createdAt: range },
      _count: { _all: true },
    }),
    prisma.confirmationAttempt.groupBy({
      by: ['createdById'],
      where: { createdById: { not: null }, createdAt: range, outcome: 'REACHED' },
      _count: { _all: true },
    }),
    prisma.customerCall.groupBy({
      by: ['loggedById'],
      where: { createdAt: range },
      _count: { _all: true },
    }),
    prisma.application.groupBy({
      by: ['reviewRequestById', 'reviewRequestVia'],
      where: { reviewRequestById: { not: null }, reviewRequestSentAt: range },
      _count: { _all: true },
    }),
  ]);

  const confirmedBy = tally(confirmed as unknown as Record<string, unknown>[], 'confirmedById');
  const issuesBy = tally(issues as unknown as Record<string, unknown>[], 'confirmedById');
  const attemptsBy = tally(attempts as unknown as Record<string, unknown>[], 'createdById');
  const reachedBy = tally(reached as unknown as Record<string, unknown>[], 'createdById');
  const callsBy = tally(calls as unknown as Record<string, unknown>[], 'loggedById');
  const reviewEmailBy = new Map<string, number>();
  const reviewTextBy = new Map<string, number>();
  for (const g of reviews) {
    const id = g.reviewRequestById;
    if (!id) continue;
    const n = g._count?._all ?? 0;
    const via = (g.reviewRequestVia || '').toLowerCase();
    const bucket = via === 'sms' || via === 'text' ? reviewTextBy : reviewEmailBy;
    bucket.set(id, (bucket.get(id) ?? 0) + n);
  }

  const rows: ConfirmationUserRow[] = users.map((u) => {
    const reviewEmail = reviewEmailBy.get(u.id) ?? 0;
    const reviewText = reviewTextBy.get(u.id) ?? 0;
    return {
      userId: u.id,
      name: u.name,
      email: u.email,
      dealsConfirmed: confirmedBy.get(u.id) ?? 0,
      issues: issuesBy.get(u.id) ?? 0,
      callAttempts: attemptsBy.get(u.id) ?? 0,
      reached: reachedBy.get(u.id) ?? 0,
      callsLogged: callsBy.get(u.id) ?? 0,
      reviewEmail,
      reviewText,
      reviewTotal: reviewEmail + reviewText,
    };
  });

  // Busiest first; drop staff with zero activity so the table stays signal.
  const active = rows.filter(
    (r) => r.dealsConfirmed || r.issues || r.callAttempts || r.callsLogged || r.reviewTotal,
  );
  active.sort((a, b) => b.dealsConfirmed - a.dealsConfirmed || b.callAttempts - a.callAttempts);

  const totals = active.reduce<ConfirmationTeamTotals>(
    (t, r) => ({
      dealsConfirmed: t.dealsConfirmed + r.dealsConfirmed,
      issues: t.issues + r.issues,
      callAttempts: t.callAttempts + r.callAttempts,
      reached: t.reached + r.reached,
      callsLogged: t.callsLogged + r.callsLogged,
      reviewEmail: t.reviewEmail + r.reviewEmail,
      reviewText: t.reviewText + r.reviewText,
      reviewTotal: t.reviewTotal + r.reviewTotal,
    }),
    { dealsConfirmed: 0, issues: 0, callAttempts: 0, reached: 0, callsLogged: 0, reviewEmail: 0, reviewText: 0, reviewTotal: 0 },
  );

  return { start, end, rows: active, totals };
}
