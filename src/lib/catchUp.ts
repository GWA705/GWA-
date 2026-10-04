import 'server-only';
import { prisma } from '@/lib/db';

/**
 * Morning catch-up digest for reviewers — "what happened since you were last
 * caught up." It reads the same live signals the rest of the staff area uses
 * (flagged confirmation issues, new deals, returned funding packages, pending
 * cancellations) and summarises everything since the reviewer last pressed
 * "Mark caught up" (User.catchUpSeenAt). Because that timestamp only advances on
 * an explicit dismiss, a weekend is handled for free: clear it Friday, come back
 * Monday, and Monday's digest covers everything since Friday.
 */

const DAY = 86_400_000;

export interface CatchUpItem {
  applicationId: string;
  name: string;
  office: string;
  preview: string | null;
  timeLabel: string;
}

export interface CatchUp {
  since: Date;
  sinceLabel: string;
  counts: { issueReplies: number; newDeals: number; fundingIn: number; cancellations: number };
  total: number;
  replies: CatchUpItem[];
  cancellations: CatchUpItem[];
}

/**
 * The window start. Defaults to the last 24h when the reviewer has never cleared
 * the digest, and never looks back more than 7 days (so an undismissed digest
 * can't balloon).
 */
export function catchUpSince(lastSeen: Date | null, now: Date): Date {
  const floor = new Date(now.getTime() - 7 * DAY);
  const base = lastSeen ?? new Date(now.getTime() - DAY);
  return base.getTime() < floor.getTime() ? floor : base;
}

function timeLabel(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

function dateLabel(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(d);
}

function custName(a: { applicantFirstName: string; applicantLastName: string } | null): string {
  return a ? `${a.applicantFirstName} ${a.applicantLastName}`.trim() : 'Deal';
}

export async function buildCatchUp(userId: string): Promise<CatchUp> {
  const now = new Date();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { catchUpSeenAt: true } });
  const since = catchUpSince(user?.catchUpSeenAt ?? null, now);

  // Counts (cheap, indexed).
  const [newDeals, fundingIn, cancellationCount] = await Promise.all([
    prisma.application.count({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] }, createdAt: { gte: since } } }),
    prisma.application.count({ where: { status: 'FUNDING_SUBMITTED', lastDealerActionAt: { gte: since } } }),
    prisma.dealCancellation.count({ where: { status: 'PENDING', createdAt: { gte: since } } }),
  ]);

  // Office replies on flagged confirmation issues — the follow-up signal. A DEAL
  // conversation on a deal still flagged ISSUE, touched since the cutoff, whose
  // latest message came from the office (not staff, not the auto-responder).
  const convs = await prisma.conversation.findMany({
    where: {
      kind: 'DEAL',
      lastMessageAt: { gte: since },
      application: { confirmationStatus: 'ISSUE' },
    },
    orderBy: { lastMessageAt: 'desc' },
    take: 50,
    select: {
      dealer: { select: { name: true } },
      application: { select: { id: true, applicantFirstName: true, applicantLastName: true } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { fromStaff: true, auto: true, body: true, createdAt: true } },
    },
  });
  const replies: CatchUpItem[] = [];
  for (const c of convs) {
    const last = c.messages[0];
    if (!last || last.fromStaff || last.auto) continue; // office must have spoken last
    if (!c.application) continue;
    replies.push({
      applicationId: c.application.id,
      name: custName(c.application),
      office: c.dealer.name,
      preview: last.body.slice(0, 120),
      timeLabel: timeLabel(last.createdAt),
    });
  }

  // Pending cancellation requests raised in the window — "needs a decision."
  const cancels = await prisma.dealCancellation.findMany({
    where: { status: 'PENDING', createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      createdAt: true,
      wasFunded: true,
      application: { select: { id: true, applicantFirstName: true, applicantLastName: true, dealer: { select: { name: true } } } },
    },
  });
  const cancellations: CatchUpItem[] = cancels
    .filter((c) => c.application)
    .map((c) => ({
      applicationId: c.application!.id,
      name: custName(c.application),
      office: c.application!.dealer?.name ?? '',
      preview: c.wasFunded ? 'Funded deal — HD refund owed' : 'Cancellation requested',
      timeLabel: timeLabel(c.createdAt),
    }));

  const counts = { issueReplies: replies.length, newDeals, fundingIn, cancellations: cancellationCount };
  const total = counts.issueReplies + counts.newDeals + counts.fundingIn + counts.cancellations;

  return { since, sinceLabel: dateLabel(since), counts, total, replies, cancellations };
}
