import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaffSection } from '@/lib/session';
import { prisma } from '@/lib/db';
import { getT } from '@/i18n/server';
import { DeleteRemittanceButton } from '../DeleteRemittanceButton';
import { ReprocessRemittanceButton } from '../ReprocessRemittanceButton';

export const dynamic = 'force-dynamic';

const money = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmt = (d: Date | null) => (d ? new Date(d).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' }) : '—');

const CHIP: Record<string, string> = {
  MATCHED: 'bg-green-100 text-green-800',
  UNMATCHED: 'bg-amber-100 text-amber-800',
  CHARGEBACK: 'bg-red-100 text-red-700',
  DEDUCTION: 'bg-purple-100 text-purple-700',
};

export default async function RemittanceDetailPage({ params }: { params: { id: string } }) {
  await requireStaffSection('remittances');
  const t = getT();
  const r = await prisma.hdRemittance.findUnique({
    where: { id: params.id },
    include: {
      processedBy: { select: { name: true } },
      lines: {
        orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
        include: { application: { select: { id: true, applicantFirstName: true, applicantLastName: true, status: true } } },
      },
    },
  });
  if (!r) notFound();

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href="/staff/remittances" className="text-sm text-gray-500 hover:underline">{t('remit.detail.backAll')}</Link>
          <h1 className="mt-2 text-xl font-semibold text-gray-900">{t('remit.detail.title', { doc: r.documentNumber ?? t('remit.manualTag') })}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {r.source === 'MANUAL' ? t('remit.detail.enteredManually') : t('remit.detail.receivedAuto')}
            {r.processedBy?.name ? t('remit.detail.byName', { name: r.processedBy.name }) : ''} · {fmt(r.createdAt)} · {t('remit.paymentDate')} {fmt(r.paymentDate)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <ReprocessRemittanceButton id={r.id} docNumber={r.documentNumber} />
          <DeleteRemittanceButton id={r.id} docNumber={r.documentNumber} />
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <span className="rounded-lg bg-gray-50 px-3 py-2"><span className="font-bold">{r.lineCount}</span> {t('remit.detail.chipLines')}</span>
        <span className="rounded-lg bg-green-50 px-3 py-2 text-green-800"><span className="font-bold">{r.matchedCount}</span> {t('remit.detail.chipMatched')}</span>
        <span className="rounded-lg bg-red-50 px-3 py-2 text-red-700"><span className="font-bold">{r.chargebackCount}</span> {t('remit.detail.chipChargebacks')}</span>
        {r.totalNet != null && <span className="rounded-lg bg-gray-900 px-3 py-2 font-bold text-white">{money(Number(r.totalNet))} {t('remit.detail.chipNet')}</span>}
      </div>

      <section className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3">{t('remit.detail.colHdId')}</th>
              <th className="px-4 py-3">{t('remit.detail.colCustomer')}</th>
              <th className="px-4 py-3">{t('remit.detail.colInvoiceDate')}</th>
              <th className="px-4 py-3 text-right">{t('remit.detail.colAmount')}</th>
              <th className="px-4 py-3">{t('remit.detail.colMatch')}</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {r.lines.map((l) => {
              const amt = Number(l.amount);
              return (
                <tr key={l.id} className={l.status === 'UNMATCHED' ? 'bg-amber-50/40' : ''}>
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{l.hdIdNumber}</td>
                  <td className="px-4 py-3 text-gray-800">
                    {l.application ? `${l.application.applicantFirstName} ${l.application.applicantLastName}` : (l.customerName ?? '—')}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{fmt(l.invoiceDate)}</td>
                  <td className={`px-4 py-3 text-right font-medium ${amt < 0 ? 'text-red-600' : 'text-gray-900'}`}>{money(amt)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${CHIP[l.status] ?? 'bg-gray-100 text-gray-600'}`}>{t(`remit.status.${l.status}`)}</span>
                    {l.fundedNow && <span className="ml-1 text-xs text-green-600">{t('remit.detail.fundedNow')}</span>}
                  </td>
                  <td className="px-4 py-3">
                    {l.application && <Link href={`/staff/applications/${l.application.id}`} className="text-sm font-medium text-brand-700 hover:underline">{t('remit.detail.openDeal')}</Link>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
