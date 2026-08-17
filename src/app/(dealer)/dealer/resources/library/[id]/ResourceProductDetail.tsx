'use client';

import { useEffect, useState } from 'react';
import { RESOURCE_FILE_KIND_LABELS } from '@/lib/constants';
import { DocViewer } from '@/components/DocViewer';
import type { ResourceFileKind } from '@prisma/client';

export interface ResourceFileView {
  id: string;
  kind: ResourceFileKind;
  label: string | null;
  mime: string;
  sizeBytes: number;
  hasThumb: boolean;
}

export interface ResourceProductView {
  id: string;
  title: string;
  brand: string | null;
  modelNumber: string | null;
  category: string | null;
  description: string | null;
  journalName: string | null;
  hasImage: boolean;
  imageVersion: number;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Full-screen image viewer, mirroring the marketplace lightbox.
function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
    >
      <div className="relative max-h-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute -right-3 -top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white text-lg text-gray-700 shadow-lg ring-1 ring-gray-200 hover:bg-gray-100"
        >
          ✕
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="max-h-[85vh] w-auto rounded-lg bg-white object-contain shadow-2xl" />
      </div>
    </div>
  );
}

// Small preview tile for a document. Images show directly; PDFs use their
// server-generated first-page thumbnail (works on every device). Falls back to a
// clean PDF tile when no thumbnail exists (e.g. files added before previews).
function DocThumb({ id, mime, label, hasThumb }: { id: string; mime: string; label: string; hasThumb: boolean }) {
  const isImage = mime.startsWith('image/');
  const thumbSrc = isImage ? `/api/resource-files/${id}` : `/api/resource-files/${id}/thumb`;
  const showImage = isImage || hasThumb;
  return (
    <div className="relative h-20 w-16 flex-none overflow-hidden rounded-md border border-gray-200 bg-white">
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumbSrc} alt={label} className="h-full w-full object-contain" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-gray-400">
          <span className="text-xl">📄</span>
          <span className="text-[10px] font-semibold">PDF</span>
        </div>
      )}
    </div>
  );
}

export function ResourceProductDetail({
  product,
  files,
}: {
  product: ResourceProductView;
  files: ResourceFileView[];
}) {
  const [lightbox, setLightbox] = useState(false);
  const imgSrc = `/api/resource-products/${product.id}/image?v=${product.imageVersion}`;
  const journalCodes = (product.journalName ?? '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="grid gap-0 sm:grid-cols-[260px_1fr]">
          {product.hasImage ? (
            <button
              type="button"
              onClick={() => setLightbox(true)}
              className="flex aspect-[4/3] w-full cursor-zoom-in items-center justify-center bg-white p-3 sm:aspect-auto sm:border-r sm:border-gray-100"
              aria-label={`View ${product.title} larger`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imgSrc} alt={product.title} className="max-h-64 w-full object-contain" />
            </button>
          ) : (
            <div className="flex aspect-[4/3] w-full items-center justify-center bg-gray-100 text-4xl text-gray-300 sm:aspect-auto">📄</div>
          )}
          <div className="space-y-2 p-5">
            <h1 className="text-xl font-semibold text-gray-900">{product.title}</h1>
            <div className="text-sm text-gray-500">
              {[product.brand, product.modelNumber && `Model ${product.modelNumber}`, product.category].filter(Boolean).join(' · ')}
            </div>
            {journalCodes.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-sm text-gray-600">
                <span>Enter on a deal as:</span>
                {journalCodes.map((c) => (
                  <span key={c} className="rounded bg-brand-50 px-1.5 py-0.5 font-semibold text-brand-700">{c}</span>
                ))}
              </div>
            )}
            {product.description && <p className="whitespace-pre-wrap text-sm text-gray-700">{product.description}</p>}
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-gray-900">Documents</h2>
        {files.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
            No files have been added for this product yet.
          </div>
        ) : (
          <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            {files.map((f) => {
              const title = f.label || RESOURCE_FILE_KIND_LABELS[f.kind];
              return (
                <div key={f.id} className="flex flex-wrap items-center gap-3 p-4">
                  {/* Open in the in-app viewer (has a Back button) — never a raw
                      file navigation, which strands you in the PDF in the app. */}
                  <DocViewer id={f.id} fileName={title} mimeType={f.mime} src={`/api/resource-files/${f.id}`} className="flex-none" title={`Open ${title}`}>
                    <DocThumb id={f.id} mime={f.mime} label={title} hasThumb={f.hasThumb} />
                  </DocViewer>
                  <div className="min-w-0 flex-1">
                    <span className="badge bg-sky-100 text-sky-800">{RESOURCE_FILE_KIND_LABELS[f.kind]}</span>
                    <div className="mt-1 truncate text-sm font-medium text-gray-900">{title}</div>
                    <div className="text-xs text-gray-400">{f.mime === 'application/pdf' ? 'PDF' : 'Image'} · {fmtSize(f.sizeBytes)}</div>
                  </div>
                  <DocViewer id={f.id} fileName={title} mimeType={f.mime} src={`/api/resource-files/${f.id}`} className="btn-secondary text-sm">
                    View
                  </DocViewer>
                  <a href={`/api/resource-files/${f.id}?download=1`} className="btn-primary text-sm">Download</a>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {lightbox && product.hasImage && <Lightbox src={imgSrc} alt={product.title} onClose={() => setLightbox(false)} />}
    </>
  );
}
