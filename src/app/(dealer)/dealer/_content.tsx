import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { prisma } from '@/lib/db';
import { CONTENT_SECTIONS } from '@/lib/constants';
import { ContentSectionView } from '@/components/ContentSectionView';

// Shared server component behind the three dealer content tabs. Underscore
// prefix keeps this file out of the router.
export async function ContentPage({ slug }: { slug: string }) {
  await requireRole('DEALER_USER');
  const meta = CONTENT_SECTIONS.find((s) => s.slug === slug);
  if (!meta) notFound();

  const items = await prisma.contentItem.findMany({
    where: { section: meta.section, active: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  });

  return (
    <ContentSectionView
      title={meta.label}
      blurb={meta.blurb}
      emptyText={meta.emptyText}
      items={items}
    />
  );
}
