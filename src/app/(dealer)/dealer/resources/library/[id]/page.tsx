import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireDealerAccess } from '@/lib/session';
import { prisma } from '@/lib/db';
import { ResourceProductDetail } from './ResourceProductDetail';

export const dynamic = 'force-dynamic';

export default async function DealerResourceProductPage({ params }: { params: { id: string } }) {
  await requireDealerAccess();
  const product = await prisma.resourceProduct.findFirst({
    where: { id: params.id, active: true },
    include: { files: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] } },
  });
  if (!product) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/dealer/resources/library" className="text-sm text-gray-500 hover:underline">← All products</Link>

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
        }))}
      />
    </div>
  );
}
