import { requireAdminSection } from '@/lib/session';
import { prisma } from '@/lib/db';
import { GiftCardQueue, type PendingCard } from './GiftCardQueue';

export const dynamic = 'force-dynamic';

const dt = (d: Date) =>
  d.toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default async function AdminGiftCardsPage() {
  await requireAdminSection('gift-cards');
  const [pendingRows, sentRows] = await Promise.all([
    prisma.giftCardRequest.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      include: { dealer: { select: { name: true } } },
    }),
    prisma.giftCardRequest.findMany({
      where: { status: 'SENT' },
      orderBy: { sentAt: 'desc' },
      take: 50,
      include: { dealer: { select: { name: true } }, sentBy: { select: { name: true } } },
    }),
  ]);

  const pending: PendingCard[] = pendingRows.map((r) => ({
    id: r.id,
    dealerName: r.dealer?.name ?? '—',
    customerName: r.customerName,
    customerEmail: r.customerEmail,
    amount: Number(r.amount),
    requestedAt: dt(r.createdAt),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Water-test gift cards</h1>
        <p className="mt-1 text-sm text-gray-500">
          Dealers submit a customer + card amount for each completed water test. Copy the selected emails (or CSV) into
          Guusto, send, then <strong>mark them sent</strong> — that stamps a dated receipt back to the dealer.
        </p>
      </div>

      <GiftCardQueue pending={pending} />

      <div className="card overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-3">
          <h2 className="text-base font-semibold text-gray-900">Recently sent</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Dealer</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Sent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sentRows.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">Nothing sent yet.</td></tr>
              ) : (
                sentRows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 font-medium text-gray-900">{r.customerName}</td>
                    <td className="px-4 py-3 text-gray-600">{r.customerEmail}</td>
                    <td className="px-4 py-3 text-gray-600">{r.dealer?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">${Number(r.amount)}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {r.sentAt ? dt(r.sentAt) : '—'}{r.sentBy?.name ? ` · ${r.sentBy.name}` : ''}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
