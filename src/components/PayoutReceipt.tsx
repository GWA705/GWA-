import type { Payout } from '@prisma/client';

type PayoutWithActor = Payout & { createdBy?: { name: string } };

export function PayoutReceipt({ payouts }: { payouts: PayoutWithActor[] }) {
  if (payouts.length === 0) {
    return <p className="text-sm text-gray-500">No payments recorded yet.</p>;
  }
  const total = payouts.reduce((sum, p) => sum + Number(p.amount), 0);
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="py-1 pr-4">Date paid</th>
            <th className="py-1 pr-4">Amount</th>
            <th className="py-1 pr-4">Method</th>
            <th className="py-1 pr-4">Reference</th>
            <th className="py-1">Note</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {payouts.map((p) => (
            <tr key={p.id}>
              <td className="py-1.5 pr-4">{p.paidOn.toLocaleDateString('en-CA')}</td>
              <td className="py-1.5 pr-4 font-medium tabular-nums">${Number(p.amount).toFixed(2)}</td>
              <td className="py-1.5 pr-4">{p.method ?? '—'}</td>
              <td className="py-1.5 pr-4">{p.reference ?? '—'}</td>
              <td className="py-1.5 text-gray-500">{p.note ?? ''}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-gray-200">
            <td className="py-2 pr-4 text-xs font-semibold uppercase text-gray-500">Total paid</td>
            <td className="py-2 pr-4 font-semibold tabular-nums">${total.toFixed(2)}</td>
            <td colSpan={3}></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
