import { requireRole } from '@/lib/session';
import { AppShell } from '@/components/AppShell';
import { AlertModal } from '@/components/AlertModal';
import { alertWhereForUser } from '@/lib/alerts';
import { prisma } from '@/lib/db';
import { canAdminSection, hasAnyAdminSection, isSuperAdmin } from '@/lib/rbac';
import { canViewReportsArea } from '@/lib/reporting/access';
import { isGlobalSearchEnabled } from '@/lib/settings';
import { canSearchAllCustomers } from '@/lib/customerSearch';
import { canManageGiftCards, staffHasGiftCardUnread } from '@/lib/giftCardAccess';

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole('REVIEWER', 'ADMIN');
  // Reviewers get the full staff nav. An admin only sees the staff areas they're
  // permitted: the Deals queue ('review-queue') and Mail ('mail'). Route guards
  // enforce the same rules.
  const canDeals = user.role === 'REVIEWER' || canAdminSection(user, 'review-queue');
  const canMail = user.role === 'REVIEWER' || canAdminSection(user, 'mail');
  const canDirectory = user.role === 'REVIEWER' || canAdminSection(user, 'directory');

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
  if (await canManageGiftCards(user)) {
    nav.push({ href: '/staff/gift-cards', label: 'Gift cards', badge: await staffHasGiftCardUnread() });
  }

  // Directory, customer search, leads and reports collapse into one "Tools"
  // menu so the bar stays short; only the permitted items are included, and the
  // group is skipped entirely when none apply.
  const tools: NavItem[] = [];
  if (canDirectory) tools.push({ href: '/staff/directory', label: 'Directory' });
  if ((await isGlobalSearchEnabled()) && (await canSearchAllCustomers(user)))
    tools.push({ href: '/staff/find-customer', label: 'Find customer' });
  if (isSuperAdmin(user) || canAdminSection(user, 'leads')) tools.push({ href: '/staff/leads', label: 'Leads' });
  if (await canViewReportsArea(user)) tools.push({ href: '/staff/reports', label: 'Reports' });
  if (tools.length > 0) nav.push({ label: 'Tools', children: tools });

  nav.push({ href: '/account', label: 'My account' });
  // Admins with any back-end access get a jump link back to the admin area.
  if (user.role === 'ADMIN' && hasAnyAdminSection(user)) nav.push({ href: '/admin', label: 'Admin' });

  const alerts = await prisma.dealerAlert.findMany({
    where: alertWhereForUser(user.role, user.dealerId, user.userId),
    orderBy: { createdAt: 'asc' },
    select: { id: true, title: true, body: true, linkUrl: true },
  });

  return (
    <AppShell user={user} portal="staff" nav={nav}>
      {children}
      {alerts.length > 0 && <AlertModal alerts={alerts} />}
    </AppShell>
  );
}
