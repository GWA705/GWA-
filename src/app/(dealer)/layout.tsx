import { requireDealerAccess } from '@/lib/session';
import { AppShell } from '@/components/AppShell';

export default async function DealerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireDealerAccess();
  return (
    <AppShell
      user={user}
      portal="dealer"
      nav={[
        { href: '/dealer', label: 'Applications' },
        { href: '/dealer/applications/new', label: 'New customer' },
        { href: '/dealer/resources', label: 'Resources' },
        { href: '/dealer/hd-promotions', label: 'HD Promotions' },
        { href: '/dealer/hd-credit-card', label: 'HD Credit Card' },
        { href: '/account', label: 'My account' },
      ]}
    >
      {children}
    </AppShell>
  );
}
