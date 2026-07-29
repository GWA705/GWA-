import type { ContentItem } from '@prisma/client';

function FileIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M4 3a2 2 0 012-2h5l5 5v9a2 2 0 01-2 2H6a2 2 0 01-2-2V3z" opacity=".2" />
      <path d="M11 1H6a2 2 0 00-2 2v14a2 2 0 002 2h8a2 2 0 002-2V6l-5-5zm3 16H6V3h4v4h4v10z" />
    </svg>
  );
}

export function ContentSectionView({
  title,
  blurb,
  emptyText,
  items,
}: {
  title: string;
  blurb: string;
  emptyText: string;
  items: ContentItem[];
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        <p className="mt-1 text-sm text-gray-500">{blurb}</p>
      </div>

      {items.length === 0 ? (
        <div className="card p-8 text-center text-sm text-gray-500">{emptyText}</div>
      ) : (
        <div className="space-y-4">
          {items.map((c) => (
            <article key={c.id} className="card p-5">
              <h2 className="text-base font-semibold text-gray-900">{c.title}</h2>
              {c.body && (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{c.body}</p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                {c.linkUrl && (
                  <a
                    href={c.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-brand-700 hover:underline"
                  >
                    Open link →
                  </a>
                )}
                {c.fileStorageKey && (
                  <>
                    <a
                      href={`/api/content/${c.id}/file`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-medium text-brand-700 hover:underline"
                    >
                      <FileIcon />
                      {c.fileName || 'View file'}
                    </a>
                    <a
                      href={`/api/content/${c.id}/file?download=1`}
                      className="text-gray-500 hover:underline"
                    >
                      Download
                    </a>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
