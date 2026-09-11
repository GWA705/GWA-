import Link from 'next/link';
import { SectionHero } from '@/components/SectionHero';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { canViewReportsArea, canViewLeadershipSnapshot, canViewDealerSnapshot } from '@/lib/reporting/access';
import { getT } from '@/i18n/server';
import type { TFunction } from '@/i18n/translator';

export const dynamic = 'force-dynamic';

interface ReportCard {
  href: string;
  title: string;
  blurb: string;
  accent: string;
  badge: string;
  available: boolean;
}

/**
 * Translate a badge for display only. `badge` stays its English value in the
 * data array because it doubles as a machine filter key (see the
 * `c.badge === 'Coming soon'` filter below), so we map it to a dictionary key
 * at render time rather than translating the raw value.
 */
function badgeLabel(t: TFunction, badge: string): string {
  const slug: Record<string, string> = {
    Leadership: 'leadership',
    'Per office': 'perOffice',
    'Per store': 'perStore',
    'Super Admin': 'superAdmin',
    Operations: 'operations',
    'Coming soon': 'comingSoon',
  };
  const key = slug[badge];
  return key ? t(`staffReportsHub.badge.${key}`) : badge;
}

export default async function ReportsLandingPage() {
  const user = await requireRole('REVIEWER', 'ADMIN');
  if (!(await canViewReportsArea(user))) notFound();

  const t = getT();

  const canLeadership = await canViewLeadershipSnapshot(user);
  const canDealerSnapshot = await canViewDealerSnapshot(user);
  const isAdmin = user.role === 'ADMIN';

  const cards: ReportCard[] = [
    {
      href: '/staff/reports/weekly',
      title: t('staffReportsHub.weekly.title'),
      blurb: t('staffReportsHub.weekly.blurb'),
      accent: '#1a2e44',
      badge: 'Leadership',
      available: canLeadership,
    },
    {
      href: '/staff/reports/monthly',
      title: t('staffReportsHub.monthly.title'),
      blurb: t('staffReportsHub.monthly.blurb'),
      accent: '#1a5fa8',
      badge: 'Per office',
      available: true,
    },
    {
      href: '/staff/reports/office-range',
      title: t('staffReportsHub.officeRange.title'),
      blurb: t('staffReportsHub.officeRange.blurb'),
      accent: '#1a5fa8',
      badge: 'Per office',
      available: true,
    },
    {
      href: '/staff/reports/funding',
      title: t('staffReportsHub.funding.title'),
      blurb: t('staffReportsHub.funding.blurb'),
      accent: '#1a7a4a',
      badge: 'Operations',
      available: true,
    },
    {
      href: '/staff/reports/finance',
      title: t('staffReportsHub.finance.title'),
      blurb: t('staffReportsHub.finance.blurb'),
      accent: '#F96302',
      badge: 'Per office',
      available: true,
    },
    {
      href: '/staff/reports/product-mix',
      title: t('staffReportsHub.productMix.title'),
      blurb: t('staffReportsHub.productMix.blurb'),
      accent: '#1a5fa8',
      badge: 'Per office',
      available: true,
    },
    {
      href: '/staff/reports/leaderboard',
      title: t('staffReportsHub.leaderboard.title'),
      blurb: t('staffReportsHub.leaderboard.blurb'),
      accent: '#1a2e44',
      badge: 'Super Admin',
      available: isAdmin,
    },
    {
      href: '/staff/reports/lead-funnel',
      title: t('staffReportsHub.leadFunnel.title'),
      blurb: t('staffReportsHub.leadFunnel.blurb'),
      accent: '#b8860b',
      badge: 'Leadership',
      available: canLeadership,
    },
    {
      href: '/staff/reports/store-week',
      title: t('staffReportsHub.storeWeek.title'),
      blurb: t('staffReportsHub.storeWeek.blurb'),
      accent: '#1a7a4a',
      badge: 'Per store',
      available: true,
    },
    {
      href: '/staff/reports/leads',
      title: t('staffReportsHub.leads.title'),
      blurb: t('staffReportsHub.leads.blurb'),
      accent: '#b8860b',
      badge: 'Leadership',
      available: canLeadership,
    },
    {
      href: '/staff/reports/dealer-snapshot',
      title: t('staffReportsHub.dealerSnapshot.title'),
      blurb: t('staffReportsHub.dealerSnapshot.blurb'),
      accent: '#7a3fa8',
      badge: 'Super Admin',
      available: canDealerSnapshot,
    },
    {
      href: '/staff/reports/product-pricing',
      title: t('staffReportsHub.productPricing.title'),
      blurb: t('staffReportsHub.productPricing.blurb'),
      accent: '#0b5bd3',
      badge: 'Super Admin',
      available: canDealerSnapshot,
    },
    {
      href: '/staff/reports/cycle-times',
      title: t('staffReportsHub.cycleTimes.title'),
      blurb: t('staffReportsHub.cycleTimes.blurb'),
      accent: '#0f766e',
      badge: 'Operations',
      available: true,
    },
  ];

  const visible = cards.filter((c) => c.available || c.badge === 'Coming soon');

  return (
    <div className="space-y-6">
      <SectionHero
        eyebrow={t('staffReports.eyebrow')}
        title={t('staffReports.title')}
        subtitle={t('staffReports.subtitle')}
        actions={
          <Link href="/staff/reports/connection" className="inline-flex items-center gap-2 rounded-lg bg-[#ffffff] px-4 py-2 text-sm font-semibold text-[#0e2b5c] transition hover:bg-blue-50">
            {t('staffReportsHub.journalConnection')}
          </Link>
        }
      />

      {!canLeadership && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
          {t('staffReportsHub.noLeadershipAccess')}
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
                      c.available ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {badgeLabel(t, c.badge)}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{c.blurb}</p>
                {clickable && <div className="pt-1 text-sm font-medium text-sky-600">{t('staffReportsHub.open')}</div>}
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
