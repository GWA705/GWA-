import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { prisma } from '@/lib/db';
import { ResourceProductDetail } from '@/app/(dealer)/dealer/resources/library/[id]/ResourceProductDetail';

export const dynamic = 'force-dynamic';

// Staff-facing, read-only view of a resource-library product. Reached from the
// customer-search snapshot (clicking a product short form) so the GWA team can
// pull up manuals/brochures for a product a customer purchased.
export default async function StaffResourceProductPage({ params }: { params: { id: string } }) {
  await requireRole('REVIEWER', 'ADMIN');
  const product = await prisma.resourceProduct.findUnique({
    where: { id: params.id },
    include: { files: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] } },
  });
  if (!product) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/staff/find-customer" className="text-sm text-gray-500 hover:underline">← Back to search</Link>

      <ResourceProductDetail
        product={{
          id: product.id,
          title: product.title,
          brand: product.brand,
          modelNumber: product.modelNumber,
          category: product.category,
          description: product.description,
          journalName: product.journalName,
          hasImage: !!product.imageStorageKey,
          imageVersion: product.updatedAt.getTime(),
        }}
        files={product.files.map((f) => ({
          id: f.id,
          kind: f.kind,
          label: f.label,
          mime: f.mime,
          sizeBytes: f.sizeBytes,
          hasThumb: !!f.thumbStorageKey,
        }))}
      />
    </div>
  );
}
