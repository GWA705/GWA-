import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdminSection } from '@/lib/session';
import { getUserUsage } from '@/lib/reporting/portalUsage';
import { Kpi, HBars, TrendChart, RangeTabs } from '../charts';

export const dynamic = 'force-dynamic';

const nf = (n: number) => n.toLocaleString('en-CA');

function parseDays(v: string | undefined): number {
  const n = Number(v);
  return n === 7 || n === 90 ? n : 30;
}

export default async function UserUsagePage({
  params,
  searchParams,
}: {
  params: { userId: string };
  searchParams: { days?: string };
}) {
  await requireAdminSection('usage');
  const days = parseDays(searchParams.days);
  const u = await getUserUsage(params.userId, days);
  if (!u.user) notFound();

  const lastActive = u.totals.lastActive
    ? u.totals.lastActive.toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })
    : '—';

  return (
    <div className="max-w-4xl space-y-6">
      <Link href={`/admin/usage?days=${days}`} className="text-sm text-gray-500 hover:underline">← Back to portal usage</Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{u.user.name}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {u.user.office ?? 'Internal / no office'} · {u.user.role} · {u.user.email}
          </p>
        </div>
        <RangeTabs days={days} base={`/admin/usage/${params.userId}`} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Kpi label="Actions" value={nf(u.totals.totalActions)} />
        <Kpi label="Active days" value={`${nf(u.totals.activeDays)} / ${days}`} />
        <Kpi label="Last active" value={lastActive} />
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900">What they do most</h2>
        <p className="mb-3 text-xs text-gray-500">Their actions, ranked</p>
        <HBars rows={u.topFeatures.map((f) => ({ label: f.label, count: f.count }))} />
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900">Their activity over time</h2>
        <p className="mb-3 text-xs text-gray-500">Actions per day</p>
        <TrendChart daily={u.daily} days={days} />
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900">Recent activity</h2>
        <p className="mb-3 text-xs text-gray-500">Their last {u.recent.length} actions</p>
        {u.recent.length === 0 ? (
          <p className="text-sm text-gray-400">No activity in this period.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {u.recent.map((r, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <div className="min-w-0">
                  <span className="font-medium text-gray-800">{r.label}</span>
                  <span className="ml-2 text-xs text-gray-400">{r.entityType}{r.detail ? ` · ${r.detail}` : ''}</span>
                </div>
                <time className="shrink-0 text-xs text-gray-400">{r.at.toLocaleString('en-CA', { dateStyle: 'short', timeStyle: 'short' })}</time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
