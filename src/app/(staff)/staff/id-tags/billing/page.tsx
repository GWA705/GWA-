import Link from 'next/link';
import { requireStaffSection } from '@/lib/session';
import { monthlyActivations, money, ID_TAG_UNIT_PRICE_CENTS } from '@/lib/idTagBilling';
import { getIdTagBillingRecipients } from '@/lib/settings';

export const dynamic = 'force-dynamic';

function thisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Staff → ID tags → Billing. Per-office monthly billing from rep activations:
 * $35/rep + the office's local provincial tax. Pick any month to re-open past
 * history; print a per-office invoice. Reviewer-role (and admins with the
 * 'id-tags' section).
 */
export default async function StaffIdTagBillingPage({ searchParams }: { searchParams: { month?: string } }) {
  await requireStaffSection('id-tags');
  const month = /^\d{4}-\d{2}$/.test(searchParams.month || '') ? searchParams.month! : thisMonth();
  const [billing, recipients] = await Promise.all([
    monthlyActivations(month),
    getIdTagBillingRecipients(),
  ]);
  const card = 'rounded-2xl bg-white shadow-sm ring-1 ring-slate-200';
  const monthName = new Date(`${month}-01T00:00:00`).toLocaleDateString('en-CA', { year: 'numeric', month: 'long' });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-slate-900">ID Tag billing</h1>
        <Link href="/staff/id-tags" className="ml-auto text-sm font-semibold text-brand-600 hover:underline">← Back to the board</Link>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        {money(ID_TAG_UNIT_PRICE_CENTS)} per rep + each office’s local provincial tax, counted the month a rep is marked <strong>Approved</strong> (or later) on the board. Pick any month to re-open past history, or download an office’s itemized invoice.
      </p>

      <form method="get" className="mt-4 flex flex-wrap items-center gap-2">
        <input type="month" name="month" defaultValue={month} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <button type="submit" className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700">View</button>
        <span className="ml-auto text-xs text-slate-400">Monthly list emails: {recipients.join(', ')}</span>
      </form>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className={`${card} px-4 py-3`}><div className="text-2xl font-extrabold text-slate-900">{billing.count}</div><div className="text-xs text-slate-500">reps activated — {monthName}</div></div>
        <div className={`${card} px-4 py-3`}><div className="text-2xl font-extrabold text-slate-900">{billing.offices.length}</div><div className="text-xs text-slate-500">offices billed</div></div>
        <div className={`${card} px-4 py-3`}><div className="text-2xl font-extrabold text-slate-900">{money(billing.totalCents)}</div><div className="text-xs text-slate-500">total incl. tax</div></div>
      </div>

      {billing.offices.length === 0 ? (
        <div className={`${card} mt-4 px-4 py-12 text-center text-sm text-slate-400`}>
          No reps activated in {monthName}. A rep counts here once they’re marked <strong>Approved</strong> (or later) on the ID-tag board.
        </div>
      ) : (
        <div className="mt-4 space-y-5">
          {billing.offices.map((o) => (
            <div key={o.dealerId} className={`${card} overflow-hidden`}>
              <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-3.5">
                <div className="min-w-0">
                  <div className="text-base font-bold text-slate-900">{o.office || '—'}</div>
                  <div className="text-xs text-slate-500">{o.province} · {o.taxLabel} · {o.count} rep{o.count === 1 ? '' : 's'} activated in {monthName}</div>
                </div>
                <a href={`/api/id-tags/invoice?dealerId=${o.dealerId}&month=${month}`} className="ml-auto rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">🖨 Download invoice (PDF)</a>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                      <th className="px-5 py-2 font-semibold">Rep name</th>
                      <th className="px-5 py-2 font-semibold">Date activated</th>
                      <th className="px-5 py-2 font-semibold">Entered by</th>
                      <th className="px-5 py-2 font-semibold text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {o.people.map((p) => (
                      <tr key={p.id} className="border-t border-slate-100">
                        <td className="px-5 py-2.5 font-medium text-slate-900">{p.name}</td>
                        <td className="px-5 py-2.5 text-slate-600">{new Date(p.activatedAt).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                        <td className="px-5 py-2.5 text-slate-400">{p.createdBy}</td>
                        <td className="px-5 py-2.5 text-right tabular-nums text-slate-700">{money(ID_TAG_UNIT_PRICE_CENTS)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-200 bg-slate-50/60">
                      <td className="px-5 py-2 text-slate-500" colSpan={3}>Subtotal — {o.count} × {money(ID_TAG_UNIT_PRICE_CENTS)}</td>
                      <td className="px-5 py-2 text-right tabular-nums text-slate-700">{money(o.subtotalCents)}</td>
                    </tr>
                    <tr className="bg-slate-50/60">
                      <td className="px-5 py-1.5 text-slate-500" colSpan={3}>{o.taxLabel}</td>
                      <td className="px-5 py-1.5 text-right tabular-nums text-slate-700">{money(o.taxCents)}</td>
                    </tr>
                    <tr className="border-t border-slate-200 bg-slate-50/60">
                      <td className="px-5 py-2.5 font-bold text-slate-900" colSpan={3}>Total (incl. tax)</td>
                      <td className="px-5 py-2.5 text-right font-bold tabular-nums text-slate-900">{money(o.totalCents)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
