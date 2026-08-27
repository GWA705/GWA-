import { requireGiftCardAccess } from '@/lib/giftCardAccess';
import { loadGiftCardQueue } from '@/lib/giftCardQueueData';
import { GiftCardQueue } from '@/app/(admin)/admin/gift-cards/GiftCardQueue';
import { StaffFlaggedGiftCards } from '@/app/(admin)/admin/gift-cards/StaffFlaggedGiftCards';

export const dynamic = 'force-dynamic';

export default async function StaffGiftCardsPage() {
  await requireGiftCardAccess();
  const { pending, flagged, sent } = await loadGiftCardQueue();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Water-test gift cards</h1>
        <p className="mt-1 text-sm text-gray-500">
          Dealers submit a customer + card amount for each completed water test. Copy the selected emails (or CSV) into
          Guusto, send, then <strong>mark them sent</strong> — that stamps a dated receipt back to the dealer.
        </p>
      </div>

      <StaffFlaggedGiftCards flagged={flagged} />

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
              {sent.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">Nothing sent yet.</td></tr>
              ) : (
                sent.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 font-medium text-gray-900">{r.customerName}</td>
                    <td className="px-4 py-3 text-gray-600">{r.customerEmail}</td>
                    <td className="px-4 py-3 text-gray-600">{r.dealerName}</td>
                    <td className="px-4 py-3 text-right tabular-nums">${r.amount}</td>
                    <td className="px-4 py-3 text-gray-500">{r.sentAt}{r.sentBy ? ` · ${r.sentBy}` : ''}</td>
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
