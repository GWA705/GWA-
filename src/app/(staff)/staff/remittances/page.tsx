import Link from 'next/link';
import { requireStaffSection } from '@/lib/session';
import { prisma } from '@/lib/db';
import { reMatchUnmatchedLines } from '@/lib/hdRemittance';
import { ManualRemittanceForm } from './ManualRemittanceForm';
import { UploadRemittanceForm } from './UploadRemittanceForm';
import { ReconcileUnmatched } from './ReconcileUnmatched';

export const dynamic = 'force-dynamic';

const money = (n: number) => `$${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmt = (d: Date | null) => (d ? new Date(d).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' }) : '—');

export default async function RemittancesPage() {
  await requireStaffSection('remittances');

  const remittances = await prisma.hdRemittance.findMany({
    orderBy: { createdAt: 'desc' },
    take: 60,
    include: { _count: { select: { lines: true } } },
  });

  // Outstanding attention: unmatched lines across all remittances, and their
  // total dollar value (chargebacks excluded — those aren't missed payments).
  const unmatchedCount = await prisma.hdRemittanceLine.count({ where: { status: 'UNMATCHED' } });
  const unmatchedAgg = await prisma.hdRemittanceLine.aggregate({
    where: { status: 'UNMATCHED', isChargeback: false },
    _sum: { amount: true },
    _count: { _all: true },
  });
  const unmatchedValue = Number(unmatchedAgg._sum.amount ?? 0);
  const unmatchedPayable = unmatchedAgg._count._all;

  // Investigate: which of those unmatched lines WOULD now match a portal deal
  // (a payment that came in before its deal existed in the portal). Dry run —
  // reports the recoverable backlog without changing anything.
  const preview = unmatchedPayable > 0 ? await reMatchUnmatchedLines({ dryRun: true }) : null;

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Home Depot remittances</h1>
        <p className="mt-1 text-sm text-gray-500">
          When Home Depot pays, each invoice on the remittance is matched to a deal by its HD #, and matched deals are
          marked <strong>Funded</strong> automatically. Dollar figures here are internal — dealers never see them.
        </p>
      </div>

      <section className="card p-5">
        <h2 className="mb-1 text-base font-semibold text-gray-900">Automatic (Mon/Wed/Fri)</h2>
        <p className="text-sm text-gray-500">
          Your Google remittance processor can POST straight into the portal:
          <code className="mx-1 rounded bg-gray-100 px-1.5 py-0.5 text-xs">POST /api/hd-remittance/ingest</code>
          with <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">Authorization: Bearer $CRON_SECRET</code>. See the
          go-live checklist for the exact payload.
        </p>
      </section>

      <section className="card p-5">
        <h2 className="mb-3 text-base font-semibold text-gray-900">Upload the HD remittance PDF</h2>
        <UploadRemittanceForm />
      </section>

      <section className="card p-5">
        <h2 className="mb-3 text-base font-semibold text-gray-900">Enter a remittance manually</h2>
        <ManualRemittanceForm />
      </section>

      {unmatchedCount > 0 && (
        <section className="card border-amber-200 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Unmatched lines — reconciliation</h2>
              <p className="mt-1 text-sm text-gray-500">
                {unmatchedCount} remittance line{unmatchedCount === 1 ? '' : 's'} didn’t match a portal deal when they came in
                {unmatchedPayable > 0 && <> — {money(unmatchedValue)} across {unmatchedPayable} payment line{unmatchedPayable === 1 ? '' : 's'} (chargebacks excluded)</>}.
                A line stays unmatched if its deal wasn’t in the portal yet, or its HD&nbsp;# hadn’t been filled in. Re-checking links any that now have a deal and funds them.
              </p>
            </div>
          </div>

          {preview && preview.recovered > 0 ? (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4">
              <p className="text-sm font-medium text-green-900">
                {preview.recovered} of these now match a deal in the portal — {money(preview.amountRecovered)}
                {preview.funded > 0 && <>, and {preview.funded} deal{preview.funded === 1 ? '' : 's'} would be marked Funded</>}
                {preview.partial > 0 && <> ({preview.partial} partial split-payment{preview.partial === 1 ? '' : 's'})</>}.
                Re-check to apply.
              </p>
              <ul className="mt-3 divide-y divide-green-100 text-sm">
                {preview.deals.slice(0, 30).map((d, i) => (
                  <li key={`${d.applicationId}-${i}`} className="flex items-center justify-between gap-3 py-1.5">
                    <Link href={`/staff/applications/${d.applicationId}`} className="text-brand-700 hover:underline">
                      {d.customer || '(no name)'} · HD&nbsp;#{d.hdReference}
                    </Link>
                    <span className="flex items-center gap-3 text-gray-600">
                      {d.funded ? <span className="rounded bg-green-100 px-1.5 text-xs font-medium text-green-800">→ Funded</span> : <span className="rounded bg-amber-100 px-1.5 text-xs text-amber-800">partial</span>}
                      <span className="font-medium text-gray-900">{money(d.amount)}</span>
                    </span>
                  </li>
                ))}
                {preview.deals.length > 30 && <li className="py-1.5 text-xs text-gray-500">…and {preview.deals.length - 30} more.</li>}
              </ul>
            </div>
          ) : unmatchedPayable > 0 ? (
            <p className="mt-3 text-sm text-gray-500">
              None of the unmatched payment lines match a portal deal yet — these are most likely journal-only customers (no portal application with that HD&nbsp;#). Re-check again after the matching deals are entered.
            </p>
          ) : null}

          <div className="mt-4">
            <ReconcileUnmatched />
          </div>
        </section>
      )}

      <section className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3">Received</th>
              <th className="px-4 py-3">Doc #</th>
              <th className="px-4 py-3">Payment date</th>
              <th className="px-4 py-3">Net total</th>
              <th className="px-4 py-3">Lines</th>
              <th className="px-4 py-3">Funded</th>
              <th className="px-4 py-3">Chargebacks</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {remittances.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3 text-gray-600">{fmt(r.createdAt)}<div className="text-xs text-gray-400">{r.source === 'MANUAL' ? 'manual' : 'auto'}</div></td>
                <td className="px-4 py-3 font-mono text-xs text-gray-700">{r.documentNumber ?? '—'}</td>
                <td className="px-4 py-3 text-gray-600">{fmt(r.paymentDate)}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{r.totalNet != null ? money(Number(r.totalNet)) : '—'}</td>
                <td className="px-4 py-3 text-gray-600">{r._count.lines}</td>
                <td className="px-4 py-3 text-green-700">{r.matchedCount}</td>
                <td className="px-4 py-3 text-red-700">{r.chargebackCount || '—'}</td>
                <td className="px-4 py-3"><Link href={`/staff/remittances/${r.id}`} className="text-sm font-medium text-brand-700 hover:underline">View</Link></td>
              </tr>
            ))}
            {remittances.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-500">No remittances yet.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
