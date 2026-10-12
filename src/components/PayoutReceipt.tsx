import type { Payout } from '@prisma/client';
import { getT } from '@/i18n/server';

type PayoutWithActor = Payout & { createdBy?: { name: string } };

export function PayoutReceipt({ payouts }: { payouts: PayoutWithActor[] }) {
  const t = getT();
  if (payouts.length === 0) {
    return <p className="text-sm text-gray-500">{t('dealParts.payout.noneYet')}</p>;
  }
  const total = payouts.reduce((sum, p) => sum + Number(p.amount), 0);
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="py-1 pr-4">{t('dealParts.payout.datePaid')}</th>
            <th className="py-1 pr-4">{t('dealParts.payout.amount')}</th>
            <th className="py-1 pr-4">{t('dealParts.payout.method')}</th>
            <th className="py-1 pr-4">{t('dealParts.payout.reference')}</th>
            <th className="py-1">{t('dealParts.payout.note')}</th>
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
            <td className="py-2 pr-4 text-xs font-semibold uppercase text-gray-500">{t('dealParts.payout.totalPaid')}</td>
            <td className="py-2 pr-4 font-semibold tabular-nums">${total.toFixed(2)}</td>
            <td colSpan={3}></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
