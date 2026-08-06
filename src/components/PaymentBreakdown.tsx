import { PAYMENT_METHOD_LABELS, isFinancedMethod } from '@/lib/constants';
import type { PaymentMethod } from '@prisma/client';

const money = (n: number) => `$${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Reviewer-facing payment breakdown for a split deal: each method + amount, the
 * deal total, and the financed portion called out (the number the finance
 * company funds and the loan/HD paperwork is written for).
 */
export function PaymentBreakdown({
  splits,
  total,
  financed,
}: {
  splits: { method: PaymentMethod; amount: { toString(): string } | number }[];
  total: number;
  financed: number;
}) {
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <h3 className="mb-2 text-sm font-medium text-gray-700">Payment breakdown</h3>
      <ul className="text-sm">
        {splits.map((s, i) => {
          const fin = isFinancedMethod(s.method);
          return (
            <li key={i} className="flex items-center justify-between border-b border-gray-100 py-2 last:border-0">
              <span className="flex items-center gap-2 text-gray-700">
                {PAYMENT_METHOD_LABELS[s.method]}
                <span className={`badge ${fin ? 'bg-brand-50 text-brand-700' : 'bg-gray-100 text-gray-600'}`}>
                  {fin ? 'Financed' : 'Paid'}
                </span>
              </span>
              <span className="font-mono tabular-nums">{money(Number(s.amount))}</span>
            </li>
          );
        })}
      </ul>
      <div className="mt-2 flex items-center justify-between border-t-2 border-gray-200 pt-2 font-semibold">
        <span>Deal total</span>
        <span className="font-mono tabular-nums">{money(total)}</span>
      </div>
      <div className="mt-2 flex items-center justify-between rounded-md bg-brand-50 px-3 py-2">
        <span className="text-sm font-semibold text-brand-700">Amount financed</span>
        <span className="font-mono text-base font-bold tabular-nums text-brand-700">{money(financed)}</span>
      </div>
    </div>
  );
}
