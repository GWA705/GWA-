import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireDealerAccess } from '@/lib/session';
import { isIdTagEnabledForDealer } from '@/lib/idTag';
import { monthlyActivations, dealerBillingHistory, money, ID_TAG_UNIT_PRICE_CENTS } from '@/lib/idTagBilling';

export const dynamic = 'force-dynamic';

function thisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Dealer → ID Tags → Billing. The office's own monthly ID-tag invoices: $35 per
 * team member activated + their local provincial tax. Scoped to the logged-in
 * dealer's office; they can view any month's itemized invoice and download the
 * PDF (the same one the office is billed from).
 */
export default async function DealerIdTagBillingPage({ searchParams }: { searchParams: { month?: string } }) {
  const session = await requireDealerAccess();
  if (!session.dealerId || !(await isIdTagEnabledForDealer(session.dealerId))) notFound();
  const dealerId = session.dealerId;

  const history = await dealerBillingHistory(dealerId);
  const picked = /^\d{4}-\d{2}$/.test(searchParams.month || '') ? searchParams.month! : (history[0]?.month ?? thisMonth());
  const billing = await monthlyActivations(picked);
  const bill = billing.offices.find((o) => o.dealerId === dealerId) ?? null;
  const monthName = new Date(`${picked}-01T00:00:00`).toLocaleDateString('en-CA', { year: 'numeric', month: 'long' });
  const card = 'rounded-2xl bg-white shadow-sm ring-1 ring-slate-200';

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Your ID-tag billing</h1>
        <Link href="/dealer/id-tags" className="ml-auto text-sm font-semibold text-brand-600 hover:underline">← Back to ID Tags</Link>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        {money(ID_TAG_UNIT_PRICE_CENTS)} per team member activated, plus your provincial tax. Here’s what your office owes each month — pick a month for the itemized invoice, or download the PDF.
      </p>

      {history.length === 0 ? (
        <div className={`${card} mt-5 px-4 py-12 text-center text-sm text-slate-400`}>No ID tags have been activated yet, so there’s nothing billed.</div>
      ) : (
        <>
          {/* Monthly history — every month with billing, newest first */}
          <div className={`${card} mt-5 overflow-hidden`}>
            <div className="border-b border-slate-100 px-5 py-3 text-sm font-bold text-slate-900">Monthly invoices</div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-2 font-semibold">Month</th>
                    <th className="px-5 py-2 font-semibold">Members</th>
                    <th className="px-5 py-2 font-semibold text-right">Total (incl. tax)</th>
                    <th className="px-5 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((m) => (
                    <tr key={m.month} className={`border-t border-slate-100 ${m.month === picked ? 'bg-brand-50/40' : ''}`}>
                      <td className="px-5 py-2.5 font-medium text-slate-900">{m.label}</td>
                      <td className="px-5 py-2.5 text-slate-600">{m.count}</td>
                      <td className="px-5 py-2.5 text-right font-semibold tabular-nums text-slate-900">{money(m.totalCents)}</td>
                      <td className="px-5 py-2.5 text-right whitespace-nowrap">
                        <Link href={`/dealer/id-tags/billing?month=${m.month}`} className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">View</Link>
                        <a href={`/api/id-tags/invoice?dealerId=${dealerId}&month=${m.month}`} className="ml-1.5 rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-700">⬇ PDF</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detailed itemized invoice for the selected month */}
          <div className="mt-5">
            <h2 className="mb-2 text-sm font-bold text-slate-900">Invoice detail — {monthName}</h2>
            {!bill ? (
              <div className={`${card} px-4 py-10 text-center text-sm text-slate-400`}>No team members were activated in {monthName}.</div>
            ) : (
              <div className={`${card} overflow-hidden`}>
                <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-3.5">
                  <div className="min-w-0">
                    <div className="text-base font-bold text-slate-900">{bill.office || 'Your office'}</div>
                    <div className="text-xs text-slate-500">{bill.province} · {bill.taxLabel} · {bill.count} member{bill.count === 1 ? '' : 's'} activated</div>
                  </div>
                  <a href={`/api/id-tags/invoice?dealerId=${dealerId}&month=${picked}`} className="ml-auto rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">🖨 Download invoice (PDF)</a>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                        <th className="px-5 py-2 font-semibold">Team member</th>
                        <th className="px-5 py-2 font-semibold">Date activated</th>
                        <th className="px-5 py-2 font-semibold text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bill.people.map((p) => (
                        <tr key={p.id} className="border-t border-slate-100">
                          <td className="px-5 py-2.5 font-medium text-slate-900">{p.name}</td>
                          <td className="px-5 py-2.5 text-slate-600">{new Date(p.activatedAt).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                          <td className="px-5 py-2.5 text-right tabular-nums text-slate-700">{money(ID_TAG_UNIT_PRICE_CENTS)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-slate-200 bg-slate-50/60"><td className="px-5 py-2 text-slate-500" colSpan={2}>Subtotal — {bill.count} × {money(ID_TAG_UNIT_PRICE_CENTS)}</td><td className="px-5 py-2 text-right tabular-nums text-slate-700">{money(bill.subtotalCents)}</td></tr>
                      <tr className="bg-slate-50/60"><td className="px-5 py-1.5 text-slate-500" colSpan={2}>{bill.taxLabel}</td><td className="px-5 py-1.5 text-right tabular-nums text-slate-700">{money(bill.taxCents)}</td></tr>
                      <tr className="border-t border-slate-200 bg-slate-50/60"><td className="px-5 py-2.5 font-bold text-slate-900" colSpan={2}>Total (incl. tax)</td><td className="px-5 py-2.5 text-right font-bold tabular-nums text-slate-900">{money(bill.totalCents)}</td></tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
          <p className="mt-4 text-center text-[11px] text-slate-400">A team member is billed the month they’re marked approved for their HD ID badge. Questions about your invoice? Contact the GWA office.</p>
        </>
      )}
    </div>
  );
}
