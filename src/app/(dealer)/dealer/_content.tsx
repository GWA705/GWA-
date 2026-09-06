import { notFound } from 'next/navigation';
import { requireDealerAccess } from '@/lib/session';
import { prisma } from '@/lib/db';
import { CONTENT_SECTIONS } from '@/lib/constants';
import { markContentSectionViewed } from '@/lib/inbox';
import { ContentSectionView } from '@/components/ContentSectionView';

// Per-slug hero background photo. Drop a matching file in /public to give a
// content tab its own banner; slugs not listed here fall back to the gradient.
const HERO_IMAGE: Record<string, string> = {
  'hd-credit-card': '/hd-credit-card-hero.png',
};

// Shared server component behind the dealer content tabs. Underscore
// prefix keeps this file out of the router.
export async function ContentPage({ slug, hideHero = false }: { slug: string; hideHero?: boolean }) {
  const session = await requireDealerAccess();
  const meta = CONTENT_SECTIONS.find((s) => s.slug === slug);
  if (!meta) notFound();

  const items = await prisma.contentItem.findMany({
    // Hide items whose end date has passed (endsAt in the past); no end date shows always.
    where: {
      section: meta.section,
      active: true,
      OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }],
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  });

  // Opening the section clears its "new" dot for this user.
  await markContentSectionViewed(session.userId, meta.section);

  return (
    <ContentSectionView
      title={meta.label}
      blurb={meta.blurb}
      emptyText={meta.emptyText}
      items={items}
      bgImage={HERO_IMAGE[slug]}
      hideHero={hideHero}
    />
  );
}
