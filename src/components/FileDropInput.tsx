'use client';

import { useEffect, useRef, useState } from 'react';
import { compressFiles, toFileList } from '@/lib/clientImageCompress';

function CloudIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 13v8" />
      <path d="m8 17 4-4 4 4" />
      <path d="M20 16.6A5 5 0 0 0 18 7h-1.3A8 8 0 1 0 4 15.2" />
    </svg>
  );
}

/**
 * A large, hard-to-miss drag-and-drop file field for use inside any form. It
 * renders a named <input type="file"> plus the drop zone, mirrors dropped files
 * into that input, clears itself when the parent form resets, and installs a
 * window-level guard so a file dropped just OUTSIDE the zone is ignored rather
 * than opening in the browser.
 */
export function FileDropInput({
  name,
  accept = '.pdf,.jpg,.jpeg,.png,.heic,.webp',
  multiple = true,
  variant = 'large',
  hint = 'PDF, JPG, PNG, HEIC, or WEBP',
  buttonLabel = 'Choose file',
  compressImages = true,
  onFilesChange,
}: {
  name: string;
  accept?: string;
  multiple?: boolean;
  variant?: 'large' | 'compact';
  hint?: string;
  buttonLabel?: string;
  // Shrink large photos in the browser before upload (keeps documents readable).
  // Turn off for artwork/graphics where full resolution matters.
  compressImages?: boolean;
  onFilesChange?: (names: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [names, setNames] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const cbRef = useRef(onFilesChange);
  cbRef.current = onFilesChange;

  function sync() {
    const f = inputRef.current?.files;
    const arr = f ? Array.from(f).map((x) => x.name) : [];
    setNames(arr);
    cbRef.current?.(arr);
  }

  // Downscale big photos before they're attached to the input, so the form
  // submits the smaller files. Best-effort: on any failure we keep originals.
  async function processSelection() {
    if (!compressImages || !inputRef.current?.files?.length) {
      sync();
      return;
    }
    const originals = Array.from(inputRef.current.files);
    if (!originals.some((f) => f.type.startsWith('image/'))) {
      sync();
      return;
    }
    setOptimizing(true);
    try {
      const shrunk = await compressFiles(originals);
      const list = toFileList(shrunk);
      if (list && inputRef.current) inputRef.current.files = list;
    } catch {
      /* keep originals */
    } finally {
      setOptimizing(false);
      sync();
    }
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    if (inputRef.current && e.dataTransfer.files.length > 0) {
      inputRef.current.files = e.dataTransfer.files;
      void processSelection();
    }
  }

  // Ignore files dropped just outside the zone (don't let the browser open them).
  useEffect(() => {
    const prevent = (e: DragEvent) => e.preventDefault();
    window.addEventListener('dragover', prevent);
    window.addEventListener('drop', prevent);
    return () => {
      window.removeEventListener('dragover', prevent);
      window.removeEventListener('drop', prevent);
    };
  }, []);

  // Clear the display when the surrounding form is reset (e.g. after submit).
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const onReset = () => {
      setNames([]);
      cbRef.current?.([]);
    };
    form.addEventListener('reset', onReset);
    return () => form.removeEventListener('reset', onReset);
  }, []);

  const big = variant === 'large';

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`cursor-pointer rounded-xl border-2 border-dashed text-center transition ${
        big ? 'px-6 py-12' : 'px-4 py-8'
      } ${dragging ? 'border-brand-500 bg-brand-50' : 'border-gray-300 bg-gray-50/70 hover:border-brand-400 hover:bg-brand-50/40'}`}
    >
      <input ref={inputRef} type="file" name={name} accept={accept} multiple={multiple || undefined} className="hidden" onChange={() => void processSelection()} />
      {optimizing ? (
        <div className="flex flex-col items-center gap-2 text-gray-600">
          <CloudIcon className={`${big ? 'h-10 w-10' : 'h-7 w-7'} text-brand-500`} />
          <div className="text-sm font-semibold">Optimizing photos…</div>
          <div className="text-xs text-gray-400">Shrinking large images so they upload faster</div>
        </div>
      ) : names.length === 0 ? (
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <CloudIcon className={`${big ? 'h-11 w-11' : 'h-8 w-8'} text-gray-400`} />
          <div className={`${big ? 'text-base' : 'text-sm'} font-medium text-gray-700`}>Drag and drop {multiple ? 'files' : 'a file'} here</div>
          <div className="text-xs text-gray-400">— or —</div>
          <span className="inline-flex items-center gap-2 rounded-full border-2 border-brand-500 px-5 py-2 text-sm font-semibold text-brand-700">
            <CloudIcon className="h-4 w-4" /> {buttonLabel}
          </span>
          <div className="text-xs text-gray-400">{hint}</div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 text-gray-700">
          <CloudIcon className={`${big ? 'h-10 w-10' : 'h-7 w-7'} text-brand-500`} />
          <div className="text-sm font-semibold">{names.length} file{names.length > 1 ? 's' : ''} ready</div>
          <div className="max-w-full break-words px-2 text-xs text-gray-500">{names.join(', ')}</div>
          <span className="text-xs text-gray-400">Click to change</span>
        </div>
      )}
    </div>
  );
}
