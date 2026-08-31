import { requireAdminSection } from '@/lib/session';
import { prisma } from '@/lib/db';
import { toggleContentActiveAction, deleteContentAction } from '@/app/(admin)/actions';
import { CONTENT_SECTIONS, CONTENT_SECTION_LABELS } from '@/lib/constants';
import { ContentForm } from './ContentForm';

export const dynamic = 'force-dynamic';

export default async function ContentPage() {
  await requireAdminSection('content');
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
                <div key={c.id} className="card p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      {c.thumbStorageKey && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={`/api/content/${c.id}/file?thumb=1`} alt="" className="h-12 w-12 shrink-0 rounded object-cover ring-1 ring-gray-200" />
                      )}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`badge ${c.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                            {c.active ? 'Visible' : 'Hidden'}
                          </span>
                          {c.endsAt && (
                            c.endsAt.getTime() < Date.now() ? (
                              <span className="badge bg-red-100 text-red-700">Expired {c.endsAt.toLocaleDateString('en-CA')}</span>
                            ) : (
                              <span className="badge bg-amber-100 text-amber-800">Ends {c.endsAt.toLocaleDateString('en-CA')}</span>
                            )
                          )}
                          <span className="font-medium text-gray-900">{c.title}</span>
                          <span className="text-xs text-gray-400">#{c.sortOrder}</span>
                        </div>
                        {c.body && <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-gray-600">{c.body}</p>}
                        {c.linkUrl && <p className="mt-1 truncate text-xs text-brand-700">{c.linkUrl}</p>}
                        {c.fileName && <p className="mt-1 truncate text-xs text-gray-500">📎 {c.fileName}</p>}
                      </div>
                    </div>
                    <div className="flex flex-none flex-col gap-2">
                      <form action={toggleContentActiveAction.bind(null, c.id)}>
                        <button type="submit" className="btn-secondary w-full text-xs">{c.active ? 'Hide' : 'Show'}</button>
                      </form>
                      <form action={deleteContentAction.bind(null, c.id)}>
                        <button type="submit" className="btn-danger w-full text-xs">Delete</button>
                      </form>
                    </div>
                  </div>
                  <details className="mt-3 border-t border-gray-100 pt-3">
                    <summary className="btn-secondary inline-block cursor-pointer text-xs">Edit details, link &amp; cover</summary>
                    <div className="mt-3">
                      <ContentForm
                        item={{
                          id: c.id,
                          section: c.section,
                          title: c.title,
                          body: c.body,
                          linkUrl: c.linkUrl,
                          sortOrder: c.sortOrder,
                          fileName: c.fileName,
                          hasThumb: !!c.thumbStorageKey,
                          endsAt: c.endsAt ? c.endsAt.toISOString().slice(0, 10) : null,
                        }}
                      />
                    </div>
                  </details>
                </div>
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}
