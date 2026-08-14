'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { compressFiles } from '@/lib/clientImageCompress';

interface UploadState {
  error?: string;
}
type BatchAction = (prev: UploadState, formData: FormData) => Promise<UploadState>;

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.heic,.webp';

/**
 * Guided-checklist upload: one prominent "Add" control per required funding
 * item. The category is fixed (this row), so the dealer just snaps a photo or
 * picks files and they upload straight away — no tagging, no dropdown.
 */
export function FundingItemUploader({
  action,
  category,
  isOther = false,
}: {
  action: BatchAction;
  category: string;
  isOther?: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [customLabel, setCustomLabel] = useState('');
  const [dragging, setDragging] = useState(false);
  const camRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const nameNeeded = isOther && customLabel.trim().length === 0;

  function upload(list: FileList | null) {
    if (!list || list.length === 0) return;
    if (nameNeeded) {
      setError('Name this document first.');
      return;
    }
    setError(null);
    start(async () => {
      // Shrink big photos in the browser first so they upload fast (documents
      // stay readable). PDFs and small files pass through untouched.
      const files = await compressFiles(Array.from(list));
      const fd = new FormData();
      files.forEach((file) => {
        fd.append('file', file);
        fd.append('category', category);
        fd.append('customLabel', isOther ? customLabel.trim() : '');
      });
      const res = await action({}, fd);
      if (res?.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mt-2">
      {isOther && (
        <input
          className="input mb-2 py-1.5 text-sm"
          placeholder="Name this document (e.g. Warranty)"
          value={customLabel}
          maxLength={40}
          onChange={(e) => setCustomLabel(e.target.value)}
        />
      )}
      {/* Desktop: a roomy drag-and-drop zone (click to choose too). */}
      <div
        className={`hidden cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center text-sm transition sm:flex ${
          dragging ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-300 bg-gray-50 text-gray-500 hover:border-brand-400 hover:bg-brand-50/50'
        } ${pending || nameNeeded ? 'pointer-events-none opacity-50' : ''}`}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          upload(e.dataTransfer.files);
        }}
      >
        <svg className={`h-9 w-9 ${dragging ? 'text-brand-500' : 'text-gray-400'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 13v8" />
          <path d="m8 17 4-4 4 4" />
          <path d="M20 16.6A5 5 0 0 0 18 7h-1.3A8 8 0 1 0 4 15.2" />
        </svg>
        <span><span className="font-medium text-gray-700">Drag &amp; drop</span> a file here, or <span className="font-medium text-brand-700">choose a file</span></span>
      </div>

      {/* Mobile: slim capture buttons. */}
      <div className="flex gap-2 sm:hidden">
        <button
          type="button"
          className="flex-1 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          onClick={() => camRef.current?.click()}
          disabled={pending || nameNeeded}
        >
          📷 Take photo
        </button>
        <button
          type="button"
          className="flex-1 rounded-md border border-brand-500 bg-white px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50"
          onClick={() => fileRef.current?.click()}
          disabled={pending || nameNeeded}
        >
          📎 Choose files
        </button>
      </div>
      {pending && <p className="mt-1.5 text-xs text-brand-700">Uploading…</p>}
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}

      <input
        ref={camRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          upload(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={fileRef}
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          upload(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
