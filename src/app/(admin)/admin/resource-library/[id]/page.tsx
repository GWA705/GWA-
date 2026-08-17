import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdminSection } from '@/lib/session';
import { prisma } from '@/lib/db';
import { RESOURCE_FILE_KIND_LABELS } from '@/lib/constants';
import { EditProductForm } from './EditProductForm';
import { AddFileForm } from './AddFileForm';
import { DocViewer } from '@/components/DocViewer';
import { deleteResourceFileAction } from '../actions';

export const dynamic = 'force-dynamic';

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default async function EditResourceProductPage({ params }: { params: { id: string } }) {
  await requireAdminSection('resource-library');
  const product = await prisma.resourceProduct.findUnique({
    where: { id: params.id },
    include: { files: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] } },
  });
  if (!product) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/admin/resource-library" className="text-sm text-gray-500 hover:underline">← Back to library</Link>
        <h1 className="mt-2 text-xl font-semibold text-gray-900">{product.title}</h1>
      </div>

      <div className="card p-6">
        <div className="flex gap-4">
          {product.imageStorageKey && (
            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/resource-products/${product.id}/image?v=${product.updatedAt.getTime()}`} alt="" className="h-full w-full object-cover" />
            </div>
          )}
          <div className="flex-1">
            <EditProductForm
              product={{ id: product.id, title: product.title, journalName: product.journalName, category: product.category, brand: product.brand, modelNumber: product.modelNumber, description: product.description }}
              hasImage={!!product.imageStorageKey}
            />
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="mb-1 text-sm font-semibold text-gray-900">Files</h2>
        <p className="mb-4 text-xs text-gray-500">Attach only what applies — manuals, brochures, spec sheets, warranties.</p>

        {product.files.length > 0 && (
          <div className="mb-5 divide-y divide-gray-100 rounded-lg border border-gray-200">
            {product.files.map((f) => (
              <div key={f.id} className="flex items-center gap-3 p-3">
                <span className="badge bg-slate-100 text-slate-700">{RESOURCE_FILE_KIND_LABELS[f.kind]}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-gray-900">{f.label || f.originalName || 'File'}</div>
                  <div className="text-xs text-gray-400">{f.originalName} · {fmtSize(f.sizeBytes)}</div>
                </div>
                <DocViewer id={f.id} fileName={f.label || f.originalName || 'File'} mimeType={f.mime} src={`/api/resource-files/${f.id}`} className="btn-secondary text-xs">View</DocViewer>
                <form action={deleteResourceFileAction.bind(null, f.id)}>
                  <button type="submit" className="btn-danger text-xs">Remove</button>
                </form>
              </div>
            ))}
          </div>
        )}

        <div className="rounded-lg border border-dashed border-gray-300 p-4">
          <AddFileForm productId={product.id} />
        </div>
      </div>
    </div>
  );
}
