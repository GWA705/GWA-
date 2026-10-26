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
        {money(ID_TAG_UNIT_PRICE_CENTS)} per rep activated + each office’s local provincial tax. Pick any month to re-open past history.
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

      <div className={`${card} mt-4 overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5 font-semibold">Office</th>
                <th className="px-4 py-2.5 font-semibold">Tax</th>
                <th className="px-4 py-2.5 font-semibold text-right">Reps</th>
                <th className="px-4 py-2.5 font-semibold text-right">Subtotal</th>
                <th className="px-4 py-2.5 font-semibold text-right">Tax</th>
                <th className="px-4 py-2.5 font-semibold text-right">Total</th>
                <th className="px-4 py-2.5 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {billing.offices.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">No reps activated in {monthName}.</td></tr>
              )}
              {billing.offices.map((o) => (
                <tr key={o.dealerId} className="border-t border-slate-100 align-top">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{o.office}</div>
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs text-brand-600">{o.count} rep{o.count === 1 ? '' : 's'} — details</summary>
                      <ul className="mt-1 space-y-0.5 text-xs text-slate-500">
                        {o.people.map((p) => (
                          <li key={p.id}>{p.name} · {new Date(p.activatedAt).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · by {p.createdBy}</li>
                        ))}
                      </ul>
                    </details>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{o.province} <span className="text-slate-400">({o.taxLabel})</span></td>
                  <td className="px-4 py-3 text-right tabular-nums">{o.count}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{money(o.subtotalCents)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{money(o.taxCents)}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{money(o.totalCents)}</td>
                  <td className="px-4 py-3">
                    <a href={`/api/id-tags/invoice?dealerId=${o.dealerId}&month=${month}`} className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">🖨 Invoice</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
