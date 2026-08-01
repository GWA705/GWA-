import type { Announcement } from '@prisma/client';
import { AnnouncementCarousel, BannerCard, type BannerItem } from './AnnouncementCarousel';

export function AnnouncementBanner({
  announcements,
  rotate = true,
}: {
  announcements: Announcement[];
  rotate?: boolean;
}) {
  if (announcements.length === 0) return null;

  const items: BannerItem[] = announcements.map((a) => ({
    id: a.id,
    title: a.title,
    body: a.body,
    linkUrl: a.linkUrl,
    hasImage: !!a.imageStorageKey,
  }));

  // Rotate as a slideshow when enabled for this slot and there's more than one;
  // otherwise stack the banners (or show the single one).
  if (rotate && items.length > 1) {
    return (
      <div className="mb-6">
        <AnnouncementCarousel items={items} />
      </div>
    );
  }

  return (
    <div className="mb-6 space-y-3">
      {items.map((it) => (
        <BannerCard key={it.id} item={it} />
      ))}
    </div>
  );
}
