import Link from 'next/link';
import { requireStaffSection } from '@/lib/session';
import { getT } from '@/i18n/server';
import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

// The sortable categories for cancelled deals.
const TABS = [
  { key: 'refund', labelKey: 'staffMisc.cancellations.tabs.refund.label', hintKey: 'staffMisc.cancellations.tabs.refund.hint' },
  { key: 'pending', labelKey: 'staffMisc.cancellations.tabs.pending.label', hintKey: 'staffMisc.cancellations.tabs.pending.hint' },
  { key: 'installed', labelKey: 'staffMisc.cancellations.tabs.installed.label', hintKey: 'staffMisc.cancellations.tabs.installed.hint' },
  { key: 'preinstall', labelKey: 'staffMisc.cancellations.tabs.preinstall.label', hintKey: 'staffMisc.cancellations.tabs.preinstall.hint' },
  { key: 'all', labelKey: 'common.all', hintKey: 'staffMisc.cancellations.tabs.all.hint' },
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
  const t = getT();
  const tab = (TABS.find((tb) => tb.key === searchParams.tab)?.key ?? 'refund') as TabKey;
  const STATUS_TEXT: Record<string, string> = {
    PENDING: t('staffMisc.cancellations.statusPending'),
    CONFIRMED: t('staffMisc.cancellations.statusConfirmed'),
    REJECTED: t('staffMisc.cancellations.statusRejected'),
  };

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
        <h1 className="text-xl font-semibold text-gray-900">{t('staffMisc.cancellations.pageTitle')}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {t('staffMisc.cancellations.subtitleA')} <strong>{t('staffMisc.cancellations.tabs.refund.label')}</strong> {t('staffMisc.cancellations.subtitleB')}
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
              title={t(tb.hintKey)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                on ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t(tb.labelKey)}
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
              <th className="px-4 py-3">{t('staffMisc.cancellations.headerCustomer')}</th>
              <th className="px-4 py-3">{t('staffMisc.cancellations.headerDealer')}</th>
              <th className="px-4 py-3">{t('staffMisc.cancellations.headerRequested')}</th>
              <th className="px-4 py-3">{t('staffMisc.cancellations.headerReason')}</th>
              <th className="px-4 py-3">{t('staffMisc.cancellations.headerUninstalled')}</th>
              <th className="px-4 py-3">{t('staffMisc.cancellations.headerHdRefund')}</th>
              <th className="px-4 py-3">{t('staffMisc.cancellations.headerStatus')}</th>
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
                  <div className="text-xs text-gray-400">{r.requestedBy?.name ?? t('staffMisc.cancellations.dealerFallback')}</div>
                </td>
                <td className="px-4 py-3 text-gray-600"><div className="max-w-xs">{r.reason}</div></td>
                <td className="px-4 py-3 text-gray-600">{r.wasFunded ? fmt(r.uninstallDate) : <span className="text-gray-300">{t('staffMisc.cancellations.na')}</span>}</td>
                <td className="px-4 py-3">
                  {!r.wasFunded ? (
                    <span className="text-xs text-gray-400">{t('staffMisc.cancellations.notFunded')}</span>
                  ) : r.hdRefundConfirmed ? (
                    <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">{t('staffMisc.cancellations.refunded')}</span>
                  ) : (
                    <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">{t('staffMisc.cancellations.refundDue')}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CHIP[r.status] ?? 'bg-gray-100 text-gray-600'}`}>{STATUS_TEXT[r.status] ?? r.status}</span>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/staff/applications/${r.application.id}`} className="text-sm font-medium text-brand-700 hover:underline">{t('common.open')}</Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-500">{t('staffMisc.cancellations.nothingHere')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
