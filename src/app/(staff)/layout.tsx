import { requireRole } from '@/lib/session';
import { AppShell } from '@/components/AppShell';

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole('REVIEWER', 'ADMIN');
  const nav = [{ href: '/staff', label: 'Deals' }];
  if (user.role === 'ADMIN') nav.push({ href: '/admin', label: 'Admin' });
  return (
    <AppShell user={user} nav={nav}>
      {children}
    </AppShell>
  );
}
