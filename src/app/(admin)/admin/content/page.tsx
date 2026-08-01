import { requireRole } from '@/lib/session';
import { prisma } from '@/lib/db';
import { toggleContentActiveAction, deleteContentAction } from '@/app/(admin)/actions';
import { CONTENT_SECTIONS, CONTENT_SECTION_LABELS } from '@/lib/constants';
import { ContentForm } from './ContentForm';
import { ContentThumbForm } from './ContentThumbForm';

export const dynamic = 'force-dynamic';

export default async function ContentPage() {
  await requireRole('ADMIN');
  const items = await prisma.contentItem.findMany({
    orderBy: [{ section: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Dealer content tabs</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage what dealers see under Resources, HD Promotions, and the HD Credit Card guide.
        </p>
      </div>

      <div className="card p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">New content item</h2>
        <ContentForm />
      </div>

      {CONTENT_SECTIONS.map((sec) => {
        const secItems = items.filter((i) => i.section === sec.section);
        return (
          <div key={sec.section} className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              {CONTENT_SECTION_LABELS[sec.section]}
            </h2>
            {secItems.length === 0 ? (
              <div className="card p-6 text-center text-sm text-gray-400">Nothing posted here yet.</div>
            ) : (
              secItems.map((c) => (
                <div key={c.id} className="card flex items-start justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`badge ${c.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                        {c.active ? 'Visible' : 'Hidden'}
                      </span>
                      <span className="font-medium text-gray-900">{c.title}</span>
                      <span className="text-xs text-gray-400">#{c.sortOrder}</span>
                    </div>
                    {c.body && <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-gray-600">{c.body}</p>}
                    {c.linkUrl && <p className="mt-1 truncate text-xs text-brand-700">{c.linkUrl}</p>}
                    {c.fileName && <p className="mt-1 truncate text-xs text-gray-500">📎 {c.fileName}</p>}
                  </div>
                  <div className="flex flex-none flex-col gap-2">
                    <ContentThumbForm id={c.id} hasThumb={!!c.thumbStorageKey} />
                    <form action={toggleContentActiveAction.bind(null, c.id)}>
                      <button type="submit" className="btn-secondary w-full text-xs">{c.active ? 'Hide' : 'Show'}</button>
                    </form>
                    <form action={deleteContentAction.bind(null, c.id)}>
                      <button type="submit" className="btn-danger w-full text-xs">Delete</button>
                    </form>
                  </div>
                </div>
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}
