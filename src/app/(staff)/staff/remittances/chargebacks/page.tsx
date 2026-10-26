import Link from 'next/link';
import { requireStaffSection } from '@/lib/session';
import { prisma } from '@/lib/db';
import { loadJournalHdRefIndex } from '@/lib/remittanceEnrich';
import { ResolveLineForm } from '../ResolveLineForm';

export const dynamic = 'force-dynamic';

const money = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmt = (d: Date | null) => (d ? new Date(d).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' }) : '—');
const digits = (s: string) => (s || '').replace(/\D/g, '');

/**
 * Home Depot chargeback tracker: every clawback line across all remittances, so
 * the office can see what HD took back, mark when it's been settled/paid back
 * (with a reference), and look it up later.
 */
export default async function ChargebacksPage() {
  await requireStaffSection('remittances');
  const [lines, journalIdx] = await Promise.all([
    prisma.hdRemittanceLine.findMany({
      where: { OR: [{ status: 'CHARGEBACK' }, { isChargeback: true }] },
      orderBy: [{ resolvedAt: 'asc' }, { createdAt: 'desc' }],
      include: {
        remittance: { select: { documentNumber: true, paymentDate: true } },
        application: { select: { id: true, applicantFirstName: true, applicantLastName: true } },
      },
    }),
    loadJournalHdRefIndex(),
  ]);

  const open = lines.filter((l) => !l.resolvedAt);
  const outstanding = open.reduce((s, l) => s + Math.abs(Number(l.amount)), 0);
  const settled = lines.filter((l) => l.resolvedAt);

  const customerOf = (l: (typeof lines)[number]) =>
    l.application ? `${l.application.applicantFirstName} ${l.application.applicantLastName}`.trim()
      : (journalIdx.get(digits(l.hdIdNumber))?.customer || l.customerName || '—');

  const Row = ({ l }: { l: (typeof lines)[number] }) => (
    <tr className="border-t border-gray-100">
      <td className="px-4 py-3 text-gray-800">{customerOf(l)}</td>
      <td className="px-4 py-3 font-mono text-xs text-gray-600">{l.hdIdNumber}</td>
      <td className="px-4 py-3 text-right font-medium text-red-600">{money(-Math.abs(Number(l.amount)))}</td>
      <td className="px-4 py-3 text-gray-600">{l.remittance?.documentNumber ?? '—'}<span className="ml-1 text-xs text-gray-400">{fmt(l.remittance?.paymentDate ?? null)}</span></td>
      <td className="px-4 py-3">
        <ResolveLineForm lineId={l.id} resolvedAt={l.resolvedAt ? l.resolvedAt.toISOString() : null} resolvedRef={l.resolvedRef} />
      </td>
    </tr>
  );

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/staff/remittances" className="text-sm text-gray-500 hover:underline">← All remittances</Link>
        <h1 className="text-xl font-semibold text-gray-900">Home Depot chargebacks</h1>
        <Link href="/staff/remittances/fees" className="ml-auto text-sm font-medium text-brand-700 hover:underline">Lead &amp; program fees →</Link>
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <span className="rounded-lg bg-red-50 px-3 py-2 text-red-700"><span className="font-bold">{open.length}</span> open</span>
        <span className="rounded-lg bg-gray-900 px-3 py-2 font-bold text-white">{money(outstanding)} outstanding</span>
        <span className="rounded-lg bg-green-50 px-3 py-2 text-green-800"><span className="font-bold">{settled.length}</span> settled</span>
      </div>

      <section className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">HD ID #</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Remittance</th>
              <th className="px-4 py-3">Settlement</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No chargebacks recorded yet.</td></tr>
            ) : (
              <>
                {open.map((l) => <Row key={l.id} l={l} />)}
                {settled.map((l) => <Row key={l.id} l={l} />)}
              </>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
