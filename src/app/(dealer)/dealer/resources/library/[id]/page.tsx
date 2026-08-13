import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireDealerAccess } from '@/lib/session';
import { prisma } from '@/lib/db';
import { RESOURCE_FILE_KIND_LABELS } from '@/lib/constants';

export const dynamic = 'force-dynamic';

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

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

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="grid gap-0 sm:grid-cols-[220px_1fr]">
          <div className="aspect-[4/3] w-full overflow-hidden bg-gray-100 sm:aspect-auto">
            {product.imageStorageKey ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/resource-products/${product.id}/image?v=${product.updatedAt.getTime()}`} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full min-h-[160px] w-full items-center justify-center text-4xl text-gray-300">📄</div>
            )}
          </div>
          <div className="space-y-2 p-5">
            <h1 className="text-xl font-semibold text-gray-900">{product.title}</h1>
            <div className="text-sm text-gray-500">
              {[product.brand, product.modelNumber && `Model ${product.modelNumber}`, product.category].filter(Boolean).join(' · ')}
            </div>
            {product.description && <p className="whitespace-pre-wrap text-sm text-gray-700">{product.description}</p>}
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-gray-900">Documents</h2>
        {product.files.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
            No files have been added for this product yet.
          </div>
        ) : (
          <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            {product.files.map((f) => (
              <div key={f.id} className="flex flex-wrap items-center gap-3 p-4">
                <span className="badge bg-sky-100 text-sky-800">{RESOURCE_FILE_KIND_LABELS[f.kind]}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-gray-900">{f.label || RESOURCE_FILE_KIND_LABELS[f.kind]}</div>
                  <div className="text-xs text-gray-400">
                    {(f.mime === 'application/pdf' ? 'PDF' : 'Image')} · {fmtSize(f.sizeBytes)}
                  </div>
                </div>
                <a href={`/api/resource-files/${f.id}`} target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm">
                  View
                </a>
                <a href={`/api/resource-files/${f.id}?download=1`} className="btn-primary text-sm">
                  Download
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
