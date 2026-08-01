import { requireDealerAccess } from '@/lib/session';
import { AppShell } from '@/components/AppShell';
import { WelcomeTour } from '@/components/WelcomeTour';
import { AlertModal } from '@/components/AlertModal';
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
    // all dealers, or specifically to their dealer).
    dealerAlerts = await prisma.dealerAlert.findMany({
      where: {
        active: true,
        OR: [{ dealerId: null }, { dealerId: user.dealerId ?? '__none__' }],
        acks: { none: { userId: user.userId } },
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true, title: true, body: true, linkUrl: true },
    });
  }

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
          { href: '/dealer/resources', label: 'Resources' },
          { href: '/dealer/hd-promotions', label: 'HD Promotions' },
          { href: '/dealer/hd-credit-card', label: 'HD Credit Card' },
          { href: '/dealer/tutorial', label: 'Tutorial' },
          { href: '/account', label: 'My account' },
        ]}
      >
        {children}
      </AppShell>
      {showTour && <WelcomeTour userName={user.name} />}
      {dealerAlerts.length > 0 && <AlertModal alerts={dealerAlerts} />}
    </>
  );
}
