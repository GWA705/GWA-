import type { Announcement } from '@prisma/client';
import { BannerImage } from './BannerImage';

function Wrap({ href, children }: { href: string | null; children: React.ReactNode }) {
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="block">
        {children}
      </a>
    );
  }
  return <>{children}</>;
}

export function AnnouncementBanner({ announcements }: { announcements: Announcement[] }) {
  if (announcements.length === 0) return null;
  return (
    <div className="mb-6 space-y-3">
      {announcements.map((a) => (
        <div key={a.id} className="overflow-hidden rounded-lg border border-brand-100 bg-brand-50">
          <Wrap href={a.linkUrl}>
            {a.imageStorageKey && (
              <BannerImage
                src={`/api/announcements/${a.id}/image`}
                alt={a.title ?? 'Announcement'}
                className="mx-auto block max-h-56 w-auto max-w-full object-contain"
              />
            )}
            {(a.title || a.body) && (
              <div className="p-4">
                {a.title && <h3 className="text-sm font-semibold text-brand-900">{a.title}</h3>}
                {a.body && <p className="mt-1 whitespace-pre-wrap text-sm text-brand-900/80">{a.body}</p>}
                {a.linkUrl && <span className="mt-1 inline-block text-xs font-medium text-brand-700 underline">Learn more →</span>}
              </div>
            )}
          </Wrap>
        </div>
      ))}
    </div>
  );
}
