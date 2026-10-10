import { requireAdminSection } from '@/lib/session';
import { getPortalUsage } from '@/lib/reporting/portalUsage';
import { Kpi, HBars, TrendChart, HourChart, RangeTabs } from './charts';

export const dynamic = 'force-dynamic';

const nf = (n: number) => n.toLocaleString('en-CA');

function parseDays(v: string | undefined): number {
  const n = Number(v);
  return n === 7 || n === 90 ? n : 30;
}

function hourLabel(h: number | null): string {
  if (h == null) return '—';
  const am = h < 12;
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve} ${am ? 'AM' : 'PM'}`;
}

export default async function PortalUsagePage({ searchParams }: { searchParams: { days?: string } }) {
  await requireAdminSection('usage');
  const days = parseDays(searchParams.days);
  const u = await getPortalUsage(days);

  const busiest = u.busiest.day || u.busiest.hour != null
    ? `${u.busiest.day ?? ''}${u.busiest.day && u.busiest.hour != null ? ' · ' : ''}${u.busiest.hour != null ? hourLabel(u.busiest.hour) : ''}`
    : '—';

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Portal usage</h1>
          <p className="mt-1 text-sm text-gray-500">
            What&apos;s getting used across the portal, and by whom. Built from the activity log.
            Click a person to see their individual stats.
          </p>
        </div>
        <RangeTabs days={days} base="/admin/usage" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Active users" value={nf(u.totals.activeUsers)} />
        <Kpi label="Actions logged" value={nf(u.totals.totalActions)} />
        <Kpi label="Logins" value={nf(u.totals.logins)} />
        <Kpi label="Busiest time" value={busiest} />
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900">Most-used features</h2>
        <p className="mb-3 text-xs text-gray-500">The actions people take most often</p>
        <HBars rows={u.topFeatures.map((f) => ({ label: f.label, count: f.count }))} />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900">Most-active offices</h2>
          <p className="mb-3 text-xs text-gray-500">Total actions by office</p>
          <HBars rows={u.byOffice.map((o) => ({ label: o.office, count: o.count }))} />
        </section>
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900">Most-active people</h2>
          <p className="mb-3 text-xs text-gray-500">Click a name for their individual stats</p>
          <HBars rows={u.byPerson.map((p) => ({ label: p.name, sub: p.office, count: p.count, href: `/admin/usage/${p.userId}?days=${days}` }))} />
        </section>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900">Activity over time</h2>
        <p className="mb-3 text-xs text-gray-500">Actions per day</p>
        <TrendChart daily={u.daily} days={days} />
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900">Busiest times of day</h2>
        <p className="mb-3 text-xs text-gray-500">When the portal gets used (Ontario time)</p>
        <HourChart hours={u.byHour} />
      </section>
    </div>
  );
}
