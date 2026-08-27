import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { AppShell } from '@/components/AppShell';
import { AlertModal } from '@/components/AlertModal';
import { alertWhereForUser } from '@/lib/alerts';
import { prisma } from '@/lib/db';
import { canAdminSection, isSuperAdmin, hasAnyAdminSection } from '@/lib/rbac';
import { isGlobalSearchEnabled } from '@/lib/settings';
import { ADMIN_SECTIONS } from '@/lib/constants';

interface NavItem {
  href?: string;
  label: string;
  badge?: boolean;
  children?: NavItem[];
}

// Logical grouping of the admin sections into a small set of top-level menus, so
// the nav stays on one line and things are easy to find. Each entry is a section
// key from ADMIN_SECTIONS; unauthorized keys are filtered out and empty groups
// are dropped.
const NAV_GROUPS: { label: string; keys: string[] }[] = [
  { label: 'Deals', keys: ['review-queue', 'reports', 'leads', 'customer-search'] },
  { label: 'Dealers', keys: ['dealers', 'directory', 'user-requests', 'support-contacts'] },
  { label: 'Content', keys: ['resource-library', 'content', 'marketplace', 'announcements', 'alerts', 'reminders', 'note-templates'] },
  { label: 'People', keys: ['users'] },
  { label: 'Settings', keys: ['finance', 'products', 'email', 'security', 'system-health', 'audit'] },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole('ADMIN');

  // A scoped admin with no back-end access at all doesn't belong in this area.
  if (!hasAnyAdminSection(user)) redirect('/account');

  // Badge sources — cheap counts for things needing attention now.
  const canQueue = canAdminSection(user, 'review-queue');
  const [pendingRequests, actionableDeals, searchEnabled] = await Promise.all([
    canAdminSection(user, 'user-requests')
      ? prisma.userRequest.count({ where: { status: 'PENDING' } })
      : Promise.resolve(0),
    canQueue
      ? prisma.application.count({ where: { status: { in: ['SUBMITTED', 'PROBLEM', 'FUNDING_SUBMITTED'] } } })
      : Promise.resolve(0),
    isGlobalSearchEnabled(),
  ]);

  const byKey = new Map(ADMIN_SECTIONS.map((s) => [s.key, s]));
  const badgeFor = (key: string): boolean =>
    (key === 'user-requests' && pendingRequests > 0) || (key === 'review-queue' && actionableDeals > 0);
  const linkFor = (key: string): NavItem | null => {
    const s = byKey.get(key);
    if (!s || !canAdminSection(user, key)) return null;
    // "Find customer" only works when the master search toggle is on; hide the
    // link otherwise so it never leads to the disabled (404) page.
    if (key === 'customer-search' && !searchEnabled) return null;
    return { href: s.href, label: s.label, badge: badgeFor(key) };
  };

  const nav: NavItem[] = [];

  // Overview is a standalone link (the dashboard).
  const overview = linkFor('overview');
  if (overview) nav.push({ ...overview, label: 'Overview' });

  // Grouped sections.
  for (const group of NAV_GROUPS) {
    const items = group.keys.map(linkFor).filter((x): x is NavItem => x !== null);
    if (items.length === 0) continue;
    // People group also carries the super-admin "Admin access" screen.
    if (group.label === 'People' && isSuperAdmin(user)) {
      items.push({ href: '/admin/access', label: 'Admin access' });
    }
    // A single-item group is nicer as a plain link.
    nav.push(items.length === 1 ? items[0] : { label: group.label, children: items });
  }

  // Gift cards is a standalone link (a frequently-actioned fulfillment queue).
  const giftCards = linkFor('gift-cards');
  if (giftCards) nav.push(giftCards);

  // Mail is a standalone link (frequent).
  const mail = linkFor('mail');
  if (mail) nav.push(mail);

  nav.push({ href: '/account', label: 'My account' });

  const alerts = await prisma.dealerAlert.findMany({
    where: alertWhereForUser(user.role, user.dealerId, user.userId),
    orderBy: { createdAt: 'asc' },
    select: { id: true, title: true, body: true, linkUrl: true },
  });
  return (
    <AppShell user={user} nav={nav}>
      {children}
      {alerts.length > 0 && <AlertModal alerts={alerts} />}
    </AppShell>
  );
}
