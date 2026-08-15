'use client';

import { useEffect, useState } from 'react';
import { RESOURCE_FILE_KIND_LABELS } from '@/lib/constants';
import type { ResourceFileKind } from '@prisma/client';

export interface ResourceFileView {
  id: string;
  kind: ResourceFileKind;
  label: string | null;
  mime: string;
  sizeBytes: number;
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

// Small preview tile for a document. Images show directly; PDFs render their
// first page inline where the browser supports it, otherwise a clean PDF tile.
function DocThumb({ id, mime, label }: { id: string; mime: string; label: string }) {
  const src = `/api/resource-files/${id}`;
  const isImage = mime.startsWith('image/');
  const isPdf = mime === 'application/pdf';
  return (
    <div className="relative h-20 w-16 flex-none overflow-hidden rounded-md border border-gray-200 bg-gray-50">
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={label} className="h-full w-full object-cover" />
      ) : isPdf ? (
        <>
          <object data={`${src}#toolbar=0&navpanes=0&view=FitH`} type="application/pdf" className="pointer-events-none h-full w-full" aria-label={label}>
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-gray-400">
              <span className="text-xl">📄</span>
              <span className="text-[10px] font-semibold">PDF</span>
            </div>
          </object>
          {/* Cover the object so clicks fall through to the row's link, not the PDF UI. */}
          <span className="absolute inset-0" aria-hidden />
        </>
      ) : (
        <div className="flex h-full w-full items-center justify-center text-2xl text-gray-300">📄</div>
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
                  <a href={`/api/resource-files/${f.id}`} target="_blank" rel="noopener noreferrer" aria-label={`Open ${title}`}>
                    <DocThumb id={f.id} mime={f.mime} label={title} />
                  </a>
                  <div className="min-w-0 flex-1">
                    <span className="badge bg-sky-100 text-sky-800">{RESOURCE_FILE_KIND_LABELS[f.kind]}</span>
                    <div className="mt-1 truncate text-sm font-medium text-gray-900">{title}</div>
                    <div className="text-xs text-gray-400">{f.mime === 'application/pdf' ? 'PDF' : 'Image'} · {fmtSize(f.sizeBytes)}</div>
                  </div>
                  <a href={`/api/resource-files/${f.id}`} target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm">View</a>
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
