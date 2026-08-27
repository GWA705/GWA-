import { requireDealerAccess } from '@/lib/session';
import { AppShell } from '@/components/AppShell';
import { WelcomeTour } from '@/components/WelcomeTour';
import { AlertModal } from '@/components/AlertModal';
import { alertWhereForUser } from '@/lib/alerts';
import { newContentSectionsForUser, unreadMailCountForUser } from '@/lib/inbox';
import { hasCalculatorAccess } from '@/lib/calculatorAccess';
import { hasDealerReportAccess } from '@/lib/reporting/access';
import { isGlobalSearchEnabled } from '@/lib/settings';
import { prisma } from '@/lib/db';
import { stopViewAsAction } from '@/app/(admin)/actions';

export default async function DealerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireDealerAccess();

  // When an admin is "viewing as" a dealer, show a persistent banner naming the
  // dealer with a one-click exit back to the admin area.
  let impersonatingName: string | null = null;
  if (user.impersonating && user.dealerId) {
    const dealer = await prisma.dealer.findUnique({ where: { id: user.dealerId }, select: { name: true } });
    impersonatingName = dealer?.name ?? 'this dealer';
  }

  // First-login welcome tour for real dealers only — not while an admin is
  // impersonating (that would pop the admin's own tour), and only until seen.
  let showTour = false;
  let dealerAlerts: { id: string; title: string; body: string; linkUrl: string | null }[] = [];
  if (user.role === 'DEALER_USER' && !user.impersonating) {
    const me = await prisma.user.findUnique({ where: { id: user.userId }, select: { tourSeenAt: true } });
    showTour = !me?.tourSeenAt;

    // Must-read pop-ups this dealer user hasn't acknowledged yet (targeted to
    // all dealers, their dealer specifically, or everyone).
    dealerAlerts = await prisma.dealerAlert.findMany({
      where: alertWhereForUser(user.role, user.dealerId, user.userId),
      orderBy: { createdAt: 'asc' },
      select: { id: true, title: true, body: true, linkUrl: true },
    });
  }

  // Attention dots: content sections with something new, and unread mail.
  const [freshSections, unreadMail, calcAccess, reportAccess, searchEnabled] = await Promise.all([
    newContentSectionsForUser(user.userId),
    user.dealerId ? unreadMailCountForUser(user.userId, user.dealerId, user.isDistributor) : Promise.resolve(0),
    hasCalculatorAccess(user),
    hasDealerReportAccess(user),
    isGlobalSearchEnabled(),
  ]);

  return (
    <>
      {impersonatingName && (
        <div className="bg-amber-500 text-amber-950">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
            <span>
              👁️ You are viewing the portal as <strong>{impersonatingName}</strong>. This is the
              dealer&apos;s own view — your access is logged.
            </span>
            <form action={stopViewAsAction}>
              <button type="submit" className="rounded-md bg-amber-950 px-3 py-1 text-xs font-medium text-white hover:bg-amber-900">
                Exit dealer view
              </button>
            </form>
          </div>
        </div>
      )}
      <AppShell
        user={user}
        portal="dealer"
        nav={[
          { href: '/dealer', label: 'Applications' },
          { href: '/dealer/applications/new', label: 'New customer' },
          { href: '/dealer/mail', label: 'Mail', badge: unreadMail > 0 },
          { href: '/dealer/marketplace', label: 'Marketplace' },
          { href: '/dealer/leads', label: 'Leads' },
          { href: '/dealer/gift-cards', label: 'Gift cards' },
          ...(searchEnabled ? [{ href: '/dealer/find-customer', label: 'Find customer' }] : []),
          ...(calcAccess ? [{ href: '/dealer/calculator', label: 'HD Payout' }] : []),
          ...(reportAccess ? [{ href: '/dealer/reports', label: 'Reports' }] : []),
          {
            label: 'Resources',
            children: [
              { href: '/dealer/resources', label: 'Resources', badge: freshSections.has('RESOURCE') },
              { href: '/dealer/resources/library', label: 'Product library' },
              { href: '/dealer/hd-promotions', label: 'HD Promotions', badge: freshSections.has('HD_PROMOTION') },
              { href: '/dealer/hd-credit-card', label: 'HD Credit Card', badge: freshSections.has('HD_CREDIT_CARD') },
              { href: '/dealer/tutorial', label: 'Tutorial' },
            ],
          },
          {
            label: 'My office',
            children: [
              { href: '/dealer/profile', label: 'Office profile' },
              { href: '/dealer/user-requests', label: 'Request logins' },
              { href: '/dealer/support', label: 'Contact / Support' },
              { href: '/account', label: 'My account' },
            ],
          },
        ]}
      >
        {children}
      </AppShell>
      {showTour && <WelcomeTour userName={user.name} />}
      {dealerAlerts.length > 0 && <AlertModal alerts={dealerAlerts} />}
    </>
  );
}
