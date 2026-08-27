import { prisma } from './db';

const dt = (d: Date) =>
  d.toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

const mapNotes = (notes: { id: string; body: string; fromDealer: boolean; createdAt: Date; author: { name: string | null } | null }[]) =>
  notes.map((n) => ({ id: n.id, body: n.body, fromDealer: n.fromDealer, author: n.author?.name ?? '—', at: dt(n.createdAt) }));

/**
 * Loads everything the staff/admin gift-card queue needs: the pending queue (with
 * notes), the "needs attention" flagged-after-send list, and the recently-sent
 * history. Also clears the staff-unread flags, since loading this page = staff
 * are now looking at the area.
 */
export async function loadGiftCardQueue() {
  const noteInclude = { orderBy: { createdAt: 'asc' as const }, include: { author: { select: { name: true } } } };
  const [pendingRows, flaggedRows, sentRows] = await Promise.all([
    prisma.giftCardRequest.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      include: { dealer: { select: { name: true } }, notes: noteInclude },
    }),
    prisma.giftCardRequest.findMany({
      where: { staffUnread: true, status: { not: 'PENDING' } },
      orderBy: { createdAt: 'desc' },
      include: { dealer: { select: { name: true } }, notes: noteInclude },
    }),
    prisma.giftCardRequest.findMany({
      where: { status: 'SENT' },
      orderBy: { sentAt: 'desc' },
      take: 50,
      include: { dealer: { select: { name: true } }, sentBy: { select: { name: true } } },
    }),
  ]);

  const pending = pendingRows.map((r) => ({
    id: r.id,
    dealerName: r.dealer?.name ?? '—',
    customerName: r.customerName,
    customerEmail: r.customerEmail,
    customerPhone: r.customerPhone,
    amount: Number(r.amount),
    requestedAt: dt(r.createdAt),
    staffUnread: r.staffUnread,
    notes: mapNotes(r.notes),
  }));

  const flagged = flaggedRows.map((r) => ({
    id: r.id,
    dealerName: r.dealer?.name ?? '—',
    customerName: r.customerName,
    customerEmail: r.customerEmail,
    customerPhone: r.customerPhone,
    amount: Number(r.amount),
    status: r.status,
    sentAt: r.sentAt ? dt(r.sentAt) : null,
    notes: mapNotes(r.notes),
  }));

  const sent = sentRows.map((r) => ({
    id: r.id,
    dealerName: r.dealer?.name ?? '—',
    customerName: r.customerName,
    customerEmail: r.customerEmail,
    amount: Number(r.amount),
    sentAt: r.sentAt ? dt(r.sentAt) : '—',
    sentBy: r.sentBy?.name ?? '',
  }));

  if (pendingRows.some((r) => r.staffUnread) || flaggedRows.length > 0) {
    await prisma.giftCardRequest.updateMany({ where: { staffUnread: true }, data: { staffUnread: false } });
  }

  return { pending, flagged, sent };
}
