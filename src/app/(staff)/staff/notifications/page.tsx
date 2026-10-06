import { requireRole } from '@/lib/session';
import { NotificationsFeed } from '@/components/NotificationsFeed';

export const dynamic = 'force-dynamic';

export default async function StaffNotificationsPage() {
  await requireRole('REVIEWER', 'ADMIN');
  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="text-xl font-semibold text-gray-900">Notifications</h1>
      <NotificationsFeed />
    </div>
  );
}
