import Link from 'next/link';
import { requireStaffSection } from '@/lib/session';
import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

// The sortable categories for cancelled deals.
const TABS = [
  { key: 'refund', label: 'Refund pending', hint: 'Funded deals cancelled, awaiting the Home Depot refund' },
  { key: 'pending', label: 'Awaiting review', hint: 'All cancellation requests not yet confirmed' },
  { key: 'installed', label: 'Installed & cancelled', hint: 'Deals that were funded/installed then cancelled' },
  { key: 'preinstall', label: 'Before install', hint: 'Deals cancelled before funding/install' },
  { key: 'all', label: 'All', hint: 'Every cancellation request' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

function whereFor(tab: TabKey): Prisma.DealCancellationWhereInput {
  switch (tab) {
    case 'refund':
      return { wasFunded: true, status: 'PENDING' };
    case 'pending':
      return { status: 'PENDING' };
    case 'installed':
      return { wasFunded: true };
    case 'preinstall':
      return { wasFunded: false };
    case 'all':
    default:
      return {};
  }
}

const fmt = (d: Date | null) => (d ? new Date(d).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' }) : '—');

const STATUS_CHIP: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  CONFIRMED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-gray-100 text-gray-600',
};

export default async function CancellationsPage({ searchParams }: { searchParams: { tab?: string } }) {
  await requireStaffSection('review-queue');
  const tab = (TABS.find((t) => t.key === searchParams.tab)?.key ?? 'refund') as TabKey;

  const [rows, counts] = await Promise.all([
    prisma.dealCancellation.findMany({
      where: whereFor(tab),
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 500,
      include: {
        requestedBy: { select: { name: true } },
        application: { select: { id: true, applicantFirstName: true, applicantLastName: true, hdReference: true, dealer: { select: { name: true } } } },
      },
    }),
    // Live counts for the two priority tabs.
    Promise.all([
      prisma.dealCancellation.count({ where: whereFor('refund') }),
      prisma.dealCancellation.count({ where: whereFor('pending') }),
    ]),
  ]);
  const [refundCount, pendingCount] = counts;

  return (
    <div className="max-w-6xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Deal cancellations</h1>
        <p className="mt-1 text-sm text-gray-500">
          Deals a dealer asked to cancel. Confirm each one from the deal page. Funded deals need a Home Depot
          refund before they can be finalized — those sit under <strong>Refund pending</strong> until done.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((tb) => {
          const on = tb.key === tab;
          const badge = tb.key === 'refund' ? refundCount : tb.key === 'pending' ? pendingCount : null;
          return (
            <Link
              key={tb.key}
              href={`/staff/cancellations?tab=${tb.key}`}
              title={tb.hint}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                on ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {tb.label}
              {badge != null && badge > 0 && (
                <span className={`rounded-full px-1.5 text-xs font-bold ${tb.key === 'refund' ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'}`}>{badge}</span>
              )}
            </Link>
          );
        })}
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Dealer</th>
              <th className="px-4 py-3">Requested</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Uninstalled</th>
              <th className="px-4 py-3">HD refund</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.id} className="align-top">
                <td className="px-4 py-3 font-medium text-gray-900">
                  {r.application.applicantFirstName} {r.application.applicantLastName}
                  {r.application.hdReference && <div className="text-xs font-normal text-gray-400">HD #{r.application.hdReference}</div>}
                </td>
                <td className="px-4 py-3 text-gray-700">{r.application.dealer.name}</td>
                <td className="px-4 py-3 text-gray-600">
                  {fmt(r.createdAt)}
                  <div className="text-xs text-gray-400">{r.requestedBy?.name ?? 'Dealer'}</div>
                </td>
                <td className="px-4 py-3 text-gray-600"><div className="max-w-xs">{r.reason}</div></td>
                <td className="px-4 py-3 text-gray-600">{r.wasFunded ? fmt(r.uninstallDate) : <span className="text-gray-300">n/a</span>}</td>
                <td className="px-4 py-3">
                  {!r.wasFunded ? (
                    <span className="text-xs text-gray-400">not funded</span>
                  ) : r.hdRefundConfirmed ? (
                    <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">✓ refunded</span>
                  ) : (
                    <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">refund due</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CHIP[r.status] ?? 'bg-gray-100 text-gray-600'}`}>{r.status}</span>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/staff/applications/${r.application.id}`} className="text-sm font-medium text-brand-700 hover:underline">Open</Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-500">Nothing here.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
