import { requireDealerAccess } from '@/lib/session';
import { prisma } from '@/lib/db';
import { GiftCardForm } from './GiftCardForm';
import { DealerGiftCards, type DealerRequestVM } from './DealerGiftCards';

export const dynamic = 'force-dynamic';

function stamp(d: Date): string {
  return d.toLocaleString('en-CA', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
const noteAt = (d: Date) => d.toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default async function DealerGiftCardsPage() {
  const session = await requireDealerAccess();
  const dealerId = session.dealerId;
  const rows = dealerId
    ? await prisma.giftCardRequest.findMany({
        where: { dealerId },
        orderBy: { createdAt: 'desc' },
        take: 200,
        include: { notes: { orderBy: { createdAt: 'asc' }, include: { author: { select: { name: true } } } } },
      })
    : [];

  const pending = rows.filter((r) => r.status === 'PENDING').length;

  const requests: DealerRequestVM[] = rows.map((r) => ({
    id: r.id,
    customerName: r.customerName,
    customerEmail: r.customerEmail,
    customerPhone: r.customerPhone,
    amount: Number(r.amount),
    status: r.status as DealerRequestVM['status'],
    sentAt: r.sentAt ? stamp(r.sentAt) : null,
    dealerUnread: r.dealerUnread,
    notes: r.notes.map((n) => ({
      id: n.id,
      body: n.body,
      fromDealer: n.fromDealer,
      author: n.author?.name ?? '—',
      at: noteAt(n.createdAt),
    })),
  }));

  // Mark this dealer's updates as read now that they're viewing the area.
  if (dealerId && rows.some((r) => r.dealerUnread)) {
    await prisma.giftCardRequest.updateMany({ where: { dealerId, dealerUnread: true }, data: { dealerUnread: false } });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Water-test gift cards</h1>
        <p className="mt-1 text-sm text-gray-500">
          Completed a water test? Request the customer&apos;s Home Depot gift card here. We email it through Guusto and
          mark it sent — you&apos;ll get a dated receipt below. Wrong email, or need to send by text? Open a request to
          fix the details or message the team.
        </p>
      </div>

      <div className="card p-6">
        <h2 className="mb-3 text-base font-semibold text-gray-900">New request</h2>
        <GiftCardForm defaultAmount={25} />
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <h2 className="text-base font-semibold text-gray-900">Your requests</h2>
          {pending > 0 && <span className="badge bg-amber-100 text-amber-800">{pending} awaiting send</span>}
        </div>
        <DealerGiftCards requests={requests} />
      </div>
    </div>
  );
}
