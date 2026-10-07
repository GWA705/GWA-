import { requireRole, hasBothPortals } from '@/lib/session';
import { roleLabel } from '@/lib/rbac';
import { StaffShell } from '@/components/StaffShell';
import { AlertModal } from '@/components/AlertModal';
import { TabUnreadNotifier } from '@/components/TabUnreadNotifier';
import { alertWhereForUser } from '@/lib/alerts';
import { prisma } from '@/lib/db';
import { canAdminSection, hasAnyAdminSection, isSuperAdmin } from '@/lib/rbac';
import { canViewReportsArea } from '@/lib/reporting/access';
import { isGlobalSearchEnabled } from '@/lib/settings';
import { canSearchAllCustomers } from '@/lib/customerSearch';
import { canManageGiftCards, staffHasGiftCardUnread } from '@/lib/giftCardAccess';
import { canEnterDirectSale } from '@/lib/directSaleAccess';
import { totalUnread } from '@/lib/chat';
import { hasOutstandingConfirmations } from '@/lib/confirmationQueue';
import { hasOpenResolutions } from '@/lib/resolutionCases';

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole('REVIEWER', 'ADMIN');
  // Reviewers get the full staff nav. An admin only sees the staff areas they're
  // permitted: the Deals queue ('review-queue') and Mail ('mail'). Route guards
  // enforce the same rules.
  const canDeals = user.role === 'REVIEWER' || canAdminSection(user, 'review-queue');
  const canMail = user.role === 'REVIEWER' || canAdminSection(user, 'mail');
  const canDirectory = user.role === 'REVIEWER' || canAdminSection(user, 'directory');
  const canConfirmations = user.role === 'REVIEWER' || canAdminSection(user, 'confirmations');

  interface NavItem {
    href?: string;
    label: string;
    badge?: boolean;
    children?: NavItem[];
  }
  const nav: NavItem[] = [];

  // Everyday queues stay as top-level tabs.
  if (canDeals) nav.push({ href: '/staff', label: 'Deals' });
  if (canMail) nav.push({ href: '/staff/mail', label: 'Mail' });
  if (canDeals) nav.push({ href: '/staff/conversations', label: 'Chat', badge: (await totalUnread(user)) > 0 });
  if (canConfirmations) nav.push({ href: '/staff/confirmations', label: 'Confirmation calls', badge: await hasOutstandingConfirmations() });
  // HD Resolution Centre — all internal staff (reviewers + admins).
  nav.push({ href: '/staff/resolutions', label: 'HD Resolution', badge: await hasOpenResolutions() });
  if (await canManageGiftCards(user)) {
    nav.push({ href: '/staff/gift-cards', label: 'Gift cards', badge: await staffHasGiftCardUnread() });
  }
  // Direct sale — Georgian Water & Air walk-in entry (all internal staff).
  if (await canEnterDirectSale(user)) {
    nav.push({ href: '/direct-sale', label: 'Direct sale' });
  }

  // Directory, customer search, leads and reports collapse into one "Tools"
  // menu so the bar stays short; only the permitted items are included, and the
  // group is skipped entirely when none apply.
  const tools: NavItem[] = [];
  if (canDirectory) tools.push({ href: '/staff/directory', label: 'Directory' });
  if ((await isGlobalSearchEnabled()) && (await canSearchAllCustomers(user)))
    tools.push({ href: '/staff/find-customer', label: 'Find customer' });
  if (user.role === 'REVIEWER' || isSuperAdmin(user) || canAdminSection(user, 'leads')) tools.push({ href: '/staff/leads', label: 'Leads' });
  if (await canViewReportsArea(user)) tools.push({ href: '/staff/reports', label: 'Reports' });
  if (tools.length > 0) nav.push({ label: 'Tools', children: tools });

  nav.push({ href: '/account', label: 'My account' });
  // Admins with any back-end access get a jump link back to the admin area.
  if (user.role === 'ADMIN' && hasAnyAdminSection(user)) nav.push({ href: '/admin', label: 'Admin' });

  const alerts = await prisma.dealerAlert.findMany({
    where: alertWhereForUser(user.role, user.dealerId, user.userId),
    orderBy: { createdAt: 'asc' },
    select: { id: true, title: true, body: true, linkUrl: true, imageStorageKey: true },
  });

  const initials =
    user.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';

  return (
    <StaffShell
      userName={user.name}
      roleLabel={roleLabel(user.role)}
      initials={initials}
      showSwitcher={hasBothPortals(user)}
      nav={nav}
    >
      {children}
      {canDeals && <TabUnreadNotifier />}
      {alerts.length > 0 && <AlertModal alerts={alerts} />}
    </StaffShell>
  );
}
