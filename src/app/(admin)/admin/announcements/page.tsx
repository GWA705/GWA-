import { requireRole } from '@/lib/session';
import { prisma } from '@/lib/db';
import { toggleAnnouncementActiveAction, toggleAnnouncementPositionAction, deleteAnnouncementAction } from '@/app/(admin)/actions';
import { AnnouncementForm } from './AnnouncementForm';
import { AnnouncementImageForm } from './AnnouncementImageForm';

export const dynamic = 'force-dynamic';

export default async function AnnouncementsPage() {
  await requireRole('ADMIN');
  const announcements = await prisma.announcement.findMany({ orderBy: { createdAt: 'desc' } });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Dealer portal sign</h1>
      <p className="-mt-3 text-sm text-gray-500">Banners on the dealer dashboard — place each at the top (above the deals) or after the deals list. Active items appear to all dealers. <span className="text-gray-400">When two or more active banners share the same spot, they rotate automatically as a slideshow.</span></p>

      <div className="card p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">New sign</h2>
        <AnnouncementForm />
      </div>

      <div className="space-y-3">
        {announcements.length === 0 ? (
          <div className="card p-8 text-center text-sm text-gray-500">No signs yet.</div>
        ) : (
          announcements.map((a) => (
            <div key={a.id} className="card flex items-start justify-between gap-4 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`badge ${a.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                    {a.active ? 'Active' : 'Hidden'}
                  </span>
                  <span className="badge bg-brand-50 text-brand-700">
                    {a.position === 'BOTTOM' ? 'After deals' : 'Top'}
                  </span>
                  {a.title && <span className="font-medium text-gray-900">{a.title}</span>}
                </div>
                {a.body && <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{a.body}</p>}
                {a.imageStorageKey && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/announcements/${a.id}/image`} alt="" className="mt-2 max-h-24 rounded border border-gray-200" />
                )}
                {a.linkUrl && <p className="mt-1 truncate text-xs text-brand-700">{a.linkUrl}</p>}
              </div>
              <div className="flex flex-none flex-col gap-2">
                <AnnouncementImageForm id={a.id} hasImage={!!a.imageStorageKey} />
                <form action={toggleAnnouncementPositionAction.bind(null, a.id)}>
                  <button type="submit" className="btn-secondary w-full text-xs">
                    {a.position === 'BOTTOM' ? 'Move to top' : 'Move after deals'}
                  </button>
                </form>
                <form action={toggleAnnouncementActiveAction.bind(null, a.id)}>
                  <button type="submit" className="btn-secondary w-full text-xs">{a.active ? 'Hide' : 'Show'}</button>
                </form>
                <form action={deleteAnnouncementAction.bind(null, a.id)}>
                  <button type="submit" className="btn-danger w-full text-xs">Delete sign</button>
                </form>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
