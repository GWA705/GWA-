import type { ContentItem } from '@prisma/client';

// Known acronyms that should stay uppercase when we standardize a title's case.
const ACRONYMS = new Set(['HD', 'HDCC', 'GHS', 'GWA', 'FAQ', 'UV', 'PH', 'SIN', 'PDF', 'ON', 'US', 'CA', 'HDFINIT']);

/**
 * Present titles in a consistent Title Case regardless of how they were typed
 * (ALL CAPS, mixed, …). Words containing a digit (years, codes) are left as-is,
 * and known acronyms stay uppercase.
 */
function standardizeTitle(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => {
      if (/\d/.test(w)) return w;
      const bare = w.replace(/[^A-Za-z]/g, '');
      if (bare.length <= 1) return w;
      if (ACRONYMS.has(bare.toUpperCase())) return w.toUpperCase();
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(' ')
    .trim();
}

function PdfCover() {
  return (
    <div className="flex h-40 w-full items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
      <span className="rounded-lg bg-red-50 px-4 py-2 text-lg font-extrabold tracking-wide text-red-600">PDF</span>
    </div>
  );
}

function LinkCover() {
  return (
    <div className="flex h-40 w-full items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100">
      <svg className="h-10 w-10 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5" />
        <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7L12 19" />
      </svg>
    </div>
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {items.map((c) => {
            const isImage = (c.fileMime || '').startsWith('image/');
            const isPdf = (c.fileMime || '').includes('pdf');
            const fileUrl = `/api/content/${c.id}/file`;
            return (
              <article key={c.id} className="card flex flex-col overflow-hidden">
                {/* Preview — a custom cover wins; otherwise the image itself, a
                    PDF cover, or a link cover. */}
                {c.thumbStorageKey ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`${fileUrl}?thumb=1`} alt={c.title} loading="lazy" className="h-40 w-full bg-gray-50 object-cover" />
                ) : c.fileStorageKey && isImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={fileUrl} alt={c.title} loading="lazy" className="h-40 w-full bg-gray-50 object-cover" />
                ) : c.fileStorageKey && isPdf ? (
                  <PdfCover />
                ) : c.linkUrl ? (
                  <LinkCover />
                ) : null}

                <div className="flex flex-1 flex-col p-5">
                  <h2 className="text-base font-semibold text-gray-900">{standardizeTitle(c.title)}</h2>
                  {c.body && (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{c.body}</p>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-2 pt-1">
                    {c.linkUrl && (
                      <a
                        href={c.linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md border border-brand-500 px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-50"
                      >
                        Open link →
                      </a>
                    )}
                    {c.fileStorageKey && (
                      <>
                        <a
                          href={fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-md border border-brand-500 px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-50"
                        >
                          View
                        </a>
                        <a
                          href={`${fileUrl}?download=1`}
                          className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700"
                        >
                          Download
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
