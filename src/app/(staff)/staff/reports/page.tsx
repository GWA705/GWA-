import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { canViewReportsArea, canViewLeadershipSnapshot, canViewDealerSnapshot } from '@/lib/reporting/access';

export const dynamic = 'force-dynamic';

interface ReportCard {
  href: string;
  title: string;
  blurb: string;
  accent: string;
  badge: string;
  available: boolean;
}

export default async function ReportsLandingPage() {
  const user = await requireRole('REVIEWER', 'ADMIN');
  if (!(await canViewReportsArea(user))) notFound();

  const canLeadership = await canViewLeadershipSnapshot(user);
  const canDealerSnapshot = await canViewDealerSnapshot(user);

  const cards: ReportCard[] = [
    {
      href: '/staff/reports/weekly',
      title: 'Weekly Snapshot',
      blurb:
        'Company-wide performance for the week — Home Depot vs Outside-HD, deal-status funnel, aging flags, financing mix, and a journal data-health check.',
      accent: '#1a2e44',
      badge: 'Leadership',
      available: canLeadership,
    },
    {
      href: '/staff/reports/monthly',
      title: 'Monthly Performance (per office)',
      blurb:
        'Each office broken down by HD store — month-over-month, vs last year, and year-to-date, with a pending-installation block.',
      accent: '#1a5fa8',
      badge: 'Per office',
      available: true,
    },
    {
      href: '/staff/reports/store-week',
      title: 'Weekly Store Detail',
      blurb: 'Per-store customer-level detail for a single week — each deal and its amount, with a store total.',
      accent: '#1a7a4a',
      badge: 'Per store',
      available: true,
    },
    {
      href: '/staff/reports/dealer-snapshot',
      title: 'Dealer Snapshot',
      blurb:
        'One row per dealer — sold and paid this month, and what’s pending now, split HD vs GWA. Open a dealer for every paid and pending deal. Quick glance before a dealer call.',
      accent: '#7a3fa8',
      badge: 'Super Admin',
      available: canDealerSnapshot,
    },
  ];

  const visible = cards.filter((c) => c.available || c.badge === 'Coming soon');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Reports</h1>
          <p className="mt-1 text-sm text-gray-600">Performance reporting, drawn from the sales journals and the portal pipeline.</p>
        </div>
        <Link href="/staff/reports/connection" className="btn-secondary text-sm">
          Journal connection
        </Link>
      </div>

      {!canLeadership && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
          You don&apos;t have access to the company-wide leadership reports yet. A Super Admin can grant it from
          Admin → Users (the &ldquo;company-wide leadership snapshot&rdquo; option).
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((c) => {
          const clickable = c.available;
          const inner = (
            <div
              className={`h-full overflow-hidden rounded-2xl shadow-sm border bg-white transition ${
                clickable ? 'border-gray-200 hover:border-gray-300 hover:shadow-sm' : 'border-gray-100 opacity-70'
              }`}
            >
              <div className="h-1.5" style={{ background: c.accent }} />
              <div className="space-y-2 p-5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-semibold text-gray-900">{c.title}</h2>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      c.available ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {c.badge}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{c.blurb}</p>
                {clickable && <div className="pt-1 text-sm font-medium text-sky-600">Open →</div>}
              </div>
            </div>
          );
          return clickable ? (
            <Link key={c.title} href={c.href} className="block">
              {inner}
            </Link>
          ) : (
            <div key={c.title}>{inner}</div>
          );
        })}
      </div>
    </div>
  );
}
