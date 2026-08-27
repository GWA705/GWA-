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

  const statusBadge = (r: (typeof requests)[number]) =>
    r.status === 'SENT' && r.sentAt ? (
      <div>
        <span className="badge bg-green-100 text-green-800">✓ Sent</span>
        <div className="mt-0.5 text-[11px] text-gray-500">{stamp(r.sentAt)}</div>
      </div>
    ) : r.status === 'CANCELLED' ? (
      <span className="badge bg-gray-100 text-gray-500">Cancelled</span>
    ) : (
      <span className="badge bg-amber-100 text-amber-800">Pending</span>
    );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Water-test gift cards</h1>
        <p className="mt-1 text-sm text-gray-500">
          Completed a water test? Request the customer&apos;s Home Depot gift card here. We email it through Guusto and
          mark it sent — you&apos;ll get a dated receipt below.
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
        {requests.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-500">No gift-card requests yet.</div>
        ) : (
          <>
            {/* Mobile: stacked cards (no horizontal scroll on a phone) */}
            <ul className="divide-y divide-gray-100 sm:hidden">
              {requests.map((r) => (
                <li key={r.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900">{r.customerName}</div>
                      <div className="truncate text-sm text-gray-600">{r.customerEmail}</div>
                    </div>
                    <div className="shrink-0 text-right tabular-nums font-medium text-gray-900">{money(r.amount)}</div>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    {statusBadge(r)}
                    {r.status === 'PENDING' && <CancelGiftCardButton id={r.id} />}
                  </div>
                </li>
              ))}
            </ul>

            {/* Desktop: full table */}
            <div className="hidden overflow-x-auto sm:block">
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
                  {requests.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-3 font-medium text-gray-900">{r.customerName}</td>
                      <td className="px-4 py-3 text-gray-600">{r.customerEmail}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{money(r.amount)}</td>
                      <td className="px-4 py-3">{statusBadge(r)}</td>
                      <td className="px-4 py-3 text-right">
                        {r.status === 'PENDING' && <CancelGiftCardButton id={r.id} />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
