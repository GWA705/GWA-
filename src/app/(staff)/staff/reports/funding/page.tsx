import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { canViewReportsArea } from '@/lib/reporting/access';
import { prisma } from '@/lib/db';
import { STATUS_LABELS } from '@/lib/constants';
import { buildFundingReport, weekWindow, monthWindow } from '@/lib/reporting/fundingReport';
import type { ApplicationStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

const money = (n: number) => `$${Math.round(n).toLocaleString('en-CA')}`;
const dt = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });

// Statuses offered as filter chips (in a sensible workflow order).
const STATUS_CHIPS: ApplicationStatus[] = [
  'FUNDED', 'FUNDING_SUBMITTED', 'FUNDING_REVIEW', 'APPROVED', 'CONDITIONAL', 'DOCS_SENT',
  'SUBMITTED', 'UNDER_REVIEW', 'PROBLEM', 'DECLINED', 'WITHDRAWN',
];

function periodLabel(p: 'week' | 'month', o: number, win: { start: Date }, weekLbl: string): string {
  if (p === 'month') {
    return win.start.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' }) + (o === 0 ? ' · this month' : '');
  }
  return weekLbl + (o === 0 ? ' · this week' : '');
}

export default async function FundingReportPage({ searchParams }: { searchParams: { p?: string; o?: string; status?: string } }) {
  const user = await requireRole('REVIEWER', 'ADMIN');
  if (!(await canViewReportsArea(user))) notFound();

  const period: 'week' | 'month' = searchParams.p === 'month' ? 'month' : 'week';
  const offset = Number.parseInt(searchParams.o ?? '0', 10) || 0;
  const win = period === 'month' ? monthWindow(offset) : weekWindow(offset);
  const report = await buildFundingReport(win);
  const label = periodLabel(period, offset, win, report.label);
  const qp = (o: number) => `/staff/reports/funding?p=${period}&o=${o}${searchParams.status ? `&status=${searchParams.status}` : ''}`;

  const status = STATUS_CHIPS.includes(searchParams.status as ApplicationStatus) ? (searchParams.status as ApplicationStatus) : null;
  const statusDeals = status
    ? await prisma.application.findMany({
        where: { status },
        orderBy: { updatedAt: 'desc' },
        take: 500,
        select: {
          id: true, applicantFirstName: true, applicantLastName: true, hdReference: true,
          approvedAmount: true, requestedAmount: true, updatedAt: true,
          dealer: { select: { name: true } },
        },
      })
    : [];
  const statusTotal = statusDeals.reduce((s, d) => s + Number(d.approvedAmount ?? d.requestedAmount ?? 0), 0);

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <Link href="/staff/reports" className="text-sm text-gray-500 hover:underline">← All reports</Link>
        <h1 className="mt-2 text-xl font-semibold text-gray-900">Funding report</h1>
        <p className="mt-1 text-sm text-gray-500">Deals <strong>paid</strong> to dealers each {period} (by date paid — actual payout amount, including deals auto-paid from a Home Depot remittance), by office. Internal — not shown to dealers.</p>
      </div>

      {/* Period toggle + navigation */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-sm">
          <Link href={`/staff/reports/funding?p=week&o=0${status ? `&status=${status}` : ''}`} className={`rounded-md px-3 py-1 font-semibold ${period === 'week' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500'}`}>Week</Link>
          <Link href={`/staff/reports/funding?p=month&o=0${status ? `&status=${status}` : ''}`} className={`rounded-md px-3 py-1 font-semibold ${period === 'month' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500'}`}>Month</Link>
        </div>
        <Link href={qp(offset - 1)} className="btn-secondary text-sm">← Previous</Link>
        <span className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-semibold text-gray-800">{label}</span>
        {offset < 0 && <Link href={qp(offset + 1)} className="btn-secondary text-sm">Next →</Link>}
      </div>

      {/* Summary tiles */}
      <div className="flex flex-wrap gap-3">
        <div className="rounded-xl bg-green-50 px-4 py-3 text-green-800"><div className="text-2xl font-bold">{report.count}</div><div className="text-xs font-medium">Deals paid</div></div>
        <div className="rounded-xl bg-gray-900 px-4 py-3 text-white"><div className="text-2xl font-bold">{money(report.total)}</div><div className="text-xs font-medium">Paid to dealers (actual $)</div></div>
        <div className="rounded-xl bg-amber-50 px-4 py-3 text-amber-800"><div className="text-2xl font-bold">{report.pipeline.count}</div><div className="text-xs font-medium">Awaiting payment (funded/approved)</div></div>
      </div>

      {/* By office */}
      <section className="card overflow-hidden">
        <div className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-900">Paid this {period} by office</div>
        {report.offices.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-gray-500">No deals paid in this {period}.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {report.offices.map((o) => (
              <details key={o.dealerName} className="group">
                <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50">
                  <span className="font-medium text-gray-900">{o.dealerName}</span>
                  <span className="flex items-center gap-4 text-sm">
                    <span className="text-gray-500">{o.count} deal{o.count === 1 ? '' : 's'}</span>
                    <span className="font-semibold text-gray-900">{money(o.total)}</span>
                  </span>
                </summary>
                <ul className="divide-y divide-gray-50 bg-gray-50/50 px-4 py-1 text-sm">
                  {o.deals.map((d) => (
                    <li key={d.applicationId} className="flex items-center justify-between gap-3 py-2">
                      <Link href={`/staff/applications/${d.applicationId}`} className="text-brand-700 hover:underline">
                        {d.customer}{d.hdReference ? ` · HD #${d.hdReference}` : ''}
                      </Link>
                      <span className="flex items-center gap-3 text-gray-500">
                        {d.currentStatus !== 'FUNDED' && <span className="rounded bg-gray-100 px-1.5 text-xs text-gray-600">{STATUS_LABELS[d.currentStatus]}</span>}
                        <span>{dt(d.paidOn)}</span>
                        <span className="font-medium text-gray-800">{money(d.amount)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        )}
      </section>

      {/* Deals by status */}
      <section className="card p-4">
        <div className="mb-3 text-sm font-semibold text-gray-900">Search deals by status</div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_CHIPS.map((s) => (
            <Link
              key={s}
              href={`/staff/reports/funding?p=${period}&o=${offset}&status=${s}`}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium ${s === status ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              {STATUS_LABELS[s]}
            </Link>
          ))}
          {status && <Link href={`/staff/reports/funding?p=${period}&o=${offset}`} className="rounded-full px-2.5 py-1 text-xs text-gray-400 hover:underline">clear</Link>}
        </div>

        {status && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium text-gray-800">{statusDeals.length} deal{statusDeals.length === 1 ? '' : 's'} in “{STATUS_LABELS[status]}”</span>
              <span className="text-gray-500">Approved value: <span className="font-semibold text-gray-800">{money(statusTotal)}</span></span>
            </div>
            {statusDeals.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-500">No deals in this status.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-100">
                <table className="min-w-full text-sm">
                  <thead><tr className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-3 py-2">Customer</th><th className="px-3 py-2">Office</th><th className="px-3 py-2">HD #</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2">Updated</th><th className="px-3 py-2"></th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {statusDeals.map((d) => (
                      <tr key={d.id}>
                        <td className="px-3 py-2 font-medium text-gray-900">{d.applicantFirstName} {d.applicantLastName}</td>
                        <td className="px-3 py-2 text-gray-600">{d.dealer.name}</td>
                        <td className="px-3 py-2 font-mono text-xs text-gray-500">{d.hdReference ?? '—'}</td>
                        <td className="px-3 py-2 text-right text-gray-800">{money(Number(d.approvedAmount ?? d.requestedAmount ?? 0))}</td>
                        <td className="px-3 py-2 text-gray-500">{d.updatedAt.toLocaleDateString('en-CA')}</td>
                        <td className="px-3 py-2"><Link href={`/staff/applications/${d.id}`} className="text-brand-700 hover:underline">Open</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
