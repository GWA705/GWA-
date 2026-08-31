import { notFound } from 'next/navigation';
import { requireDealerAccess } from '@/lib/session';
import { prisma } from '@/lib/db';
import { CONTENT_SECTIONS } from '@/lib/constants';
import { markContentSectionViewed } from '@/lib/inbox';
import { ContentSectionView } from '@/components/ContentSectionView';

// Shared server component behind the three dealer content tabs. Underscore
// prefix keeps this file out of the router.
export async function ContentPage({ slug }: { slug: string }) {
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
    />
  );
}
