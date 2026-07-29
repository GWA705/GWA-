import { requireRole } from '@/lib/session';
import { AppShell } from '@/components/AppShell';

export default async function DealerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole('DEALER_USER');
  return (
    <AppShell
      user={user}
      nav={[
        { href: '/dealer', label: 'Applications' },
        { href: '/dealer/applications/new', label: 'New application' },
        { href: '/account', label: 'My account' },
      ]}
    >
      {children}
    </AppShell>
  );
}
