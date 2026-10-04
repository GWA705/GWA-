import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { peerToken, bearerMatches } from '@/lib/portalPeer';

export const dynamic = 'force-dynamic';

/**
 * Portal -> booking "office summary" read feed.
 *
 * The booking app's morning "Today" screen shows office staff what's waiting on
 * the deal side without leaving booking: deals to review, funding packages to
 * check, cancellation requests, and dealer threads waiting on a human. This
 * endpoint hands back the counts plus a few recent items per bucket, each with
 * the deal id so booking can deep-link into /staff/applications/<id>.
 *
 * Read-only. Shared-secret auth (PORTAL_INTAKE_TOKEN) — the same token the
 * booking-status mirror uses, so one value covers both directions. The caller is
 * the booking server, not a person; no customer PII leaves here beyond a first
 * name + dealer name, which booking already shows for its own leads.
 */

const TAKE = 6;

type Item = { id: string; name: string; dealer: string; amount: number | null; at: string };

function appItem(a: {
  id: string; applicantFirstName: string; applicantLastName: string;
  requestedAmount: { toNumber: () => number } | null; createdAt: Date;
  dealer: { name: string };
}): Item {
  return {
    id: a.id,
    name: `${a.applicantFirstName} ${a.applicantLastName}`.trim(),
    dealer: a.dealer.name,
    amount: a.requestedAmount ? a.requestedAmount.toNumber() : null,
    at: a.createdAt.toISOString(),
  };
}

export async function GET(req: Request) {
  const expected = peerToken();
  if (!expected) {
    return NextResponse.json({ ok: false, error: 'The office summary feed is not switched on here.' }, { status: 503 });
  }
  if (!bearerMatches(req, expected)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const appSelect = {
    id: true, applicantFirstName: true, applicantLastName: true,
    requestedAmount: true, createdAt: true, dealer: { select: { name: true } },
  } as const;

  const TO_REVIEW = ['SUBMITTED', 'UNDER_REVIEW'] as const;
  const FUNDING = ['FUNDING_SUBMITTED', 'FUNDING_REVIEW'] as const;

  const [
    toReview, toReviewN,
    funding, fundingN,
    problems, problemsN,
    cancellations, cancellationsN,
    replies, repliesN,
  ] = await Promise.all([
    prisma.application.findMany({ where: { status: { in: [...TO_REVIEW] } }, orderBy: { createdAt: 'asc' }, take: TAKE, select: appSelect }),
    prisma.application.count({ where: { status: { in: [...TO_REVIEW] } } }),
    prisma.application.findMany({ where: { status: { in: [...FUNDING] } }, orderBy: { createdAt: 'asc' }, take: TAKE, select: appSelect }),
    prisma.application.count({ where: { status: { in: [...FUNDING] } } }),
    prisma.application.findMany({ where: { status: 'PROBLEM' }, orderBy: { updatedAt: 'desc' }, take: TAKE, select: appSelect }),
    prisma.application.count({ where: { status: 'PROBLEM' } }),
    prisma.dealCancellation.findMany({
      where: { status: 'PENDING' }, orderBy: { createdAt: 'asc' }, take: TAKE,
      select: {
        applicationId: true, wasFunded: true, createdAt: true,
        application: { select: { applicantFirstName: true, applicantLastName: true, dealer: { select: { name: true } } } },
      },
    }),
    prisma.dealCancellation.count({ where: { status: 'PENDING' } }),
    prisma.conversation.findMany({
      where: { awaitingHuman: true }, orderBy: { lastMessageAt: 'asc' }, take: TAKE,
      select: { applicationId: true, lastMessageAt: true, dealer: { select: { name: true } } },
    }),
    prisma.conversation.count({ where: { awaitingHuman: true } }),
  ]);

  return NextResponse.json(
    {
      ok: true,
      // Booking builds the deep link as <PORTAL_BASE_URL><dealPath>/<id>.
      dealPath: '/staff/applications',
      counts: {
        toReview: toReviewN, funding: fundingN, problems: problemsN,
        cancellations: cancellationsN, repliesWaiting: repliesN,
      },
      sections: {
        toReview: toReview.map(appItem),
        funding: funding.map(appItem),
        problems: problems.map(appItem),
        cancellations: cancellations.map((c) => ({
          id: c.applicationId,
          name: `${c.application.applicantFirstName} ${c.application.applicantLastName}`.trim(),
          dealer: c.application.dealer.name,
          wasFunded: c.wasFunded,
          at: c.createdAt.toISOString(),
        })),
        repliesWaiting: replies.map((r) => ({
          id: r.applicationId, // may be null for a general dealer thread
          dealer: r.dealer.name,
          at: r.lastMessageAt.toISOString(),
        })),
      },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
