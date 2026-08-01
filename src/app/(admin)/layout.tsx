import { requireRole } from '@/lib/session';
import { AppShell } from '@/components/AppShell';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole('ADMIN');
  return (
    <AppShell
      user={user}
      nav={[
        { href: '/admin', label: 'Overview' },
        { href: '/admin/dealers', label: 'Dealers' },
        { href: '/admin/finance-companies', label: 'Finance cos' },
        { href: '/admin/products', label: 'Products' },
        { href: '/admin/announcements', label: 'Dealer portal sign' },
        { href: '/admin/alerts', label: 'Pop-up alerts' },
        { href: '/admin/content', label: 'Content' },
        { href: '/admin/users', label: 'Users' },
        { href: '/admin/email', label: 'Email' },
        { href: '/admin/audit', label: 'Audit log' },
        { href: '/staff', label: 'Review queue' },
        { href: '/account', label: 'My account' },
      ]}
    >
      {children}
    </AppShell>
  );
}
