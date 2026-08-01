import type { Announcement } from '@prisma/client';
import { AnnouncementCarousel, type BannerItem } from './AnnouncementCarousel';

export function AnnouncementBanner({ announcements }: { announcements: Announcement[] }) {
  if (announcements.length === 0) return null;

  // Multiple banners in the same slot rotate as a slideshow (see
  // AnnouncementCarousel); a single one just shows.
  const items: BannerItem[] = announcements.map((a) => ({
    id: a.id,
    title: a.title,
    body: a.body,
    linkUrl: a.linkUrl,
    hasImage: !!a.imageStorageKey,
  }));

  return (
    <div className="mb-6">
      <AnnouncementCarousel items={items} />
    </div>
  );
}
