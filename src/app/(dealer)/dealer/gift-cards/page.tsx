import { requireDealerAccess } from '@/lib/session';
import { prisma } from '@/lib/db';
import { GiftCardForm } from './GiftCardForm';
import { CancelGiftCardButton } from './CancelGiftCardButton';

export const dynamic = 'force-dynamic';

const money = (n: { toString(): string }) =>
  `$${Number(n).toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

function stamp(d: Date): string {
  return d.toLocaleString('en-CA', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default async function DealerGiftCardsPage() {
  const session = await requireDealerAccess();
  const requests = session.dealerId
    ? await prisma.giftCardRequest.findMany({
        where: { dealerId: session.dealerId },
        orderBy: { createdAt: 'desc' },
        take: 200,
      })
    : [];

  const pending = requests.filter((r) => r.status === 'PENDING').length;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Water-test gift cards</h1>
        <p className="mt-1 text-sm text-gray-500">
          Completed a water test? Request the customer&apos;s Home Depot gift card here. GWA emails it through Guusto and
          marks it sent — you&apos;ll get a dated receipt below.
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
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {requests.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No gift-card requests yet.</td></tr>
              ) : (
                requests.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 font-medium text-gray-900">{r.customerName}</td>
                    <td className="px-4 py-3 text-gray-600">{r.customerEmail}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{money(r.amount)}</td>
                    <td className="px-4 py-3">
                      {r.status === 'SENT' && r.sentAt ? (
                        <div>
                          <span className="badge bg-green-100 text-green-800">✓ Sent</span>
                          <div className="mt-0.5 text-[11px] text-gray-500">{stamp(r.sentAt)}</div>
                        </div>
                      ) : r.status === 'CANCELLED' ? (
                        <span className="badge bg-gray-100 text-gray-500">Cancelled</span>
                      ) : (
                        <span className="badge bg-amber-100 text-amber-800">Pending</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.status === 'PENDING' && <CancelGiftCardButton id={r.id} />}
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
