import { requireDealerAccess } from '@/lib/session';
import { NotificationsFeed } from '@/components/NotificationsFeed';
import { getT } from '@/i18n/server';

export const dynamic = 'force-dynamic';

export default async function DealerNotificationsPage() {
  await requireDealerAccess();
  const t = getT();
  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="text-xl font-semibold text-gray-900">{t('notifications.title')}</h1>
      <NotificationsFeed />
    </div>
  );
}
