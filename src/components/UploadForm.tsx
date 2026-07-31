'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

export interface UploadState {
  error?: string;
}
type BoundUploadAction = (prev: UploadState, formData: FormData) => Promise<UploadState>;

function CloudIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 13v8" />
      <path d="m8 17 4-4 4 4" />
      <path d="M20 16.6A5 5 0 0 0 18 7h-1.3A8 8 0 1 0 4 15.2" />
    </svg>
  );
}

function SubmitButton({ label, disabled }: { label: string; disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary text-sm" disabled={pending || disabled}>
      {pending ? 'Uploading…' : label}
    </button>
  );
}

export function UploadForm({
  action,
  label = 'Upload',
  accept = '.pdf,.jpg,.jpeg,.png,.heic,.webp',
  variant = 'large',
}: {
  action: BoundUploadAction;
  label?: string;
  accept?: string;
  variant?: 'large' | 'compact';
}) {
  const [state, formAction] = useFormState(action, {} as UploadState);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [names, setNames] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);

  // Stop the browser from navigating away / opening a file that's dropped just
  // OUTSIDE the drop zone (the "it missed and opened the file" problem).
  useEffect(() => {
    const prevent = (e: DragEvent) => e.preventDefault();
    window.addEventListener('dragover', prevent);
    window.addEventListener('drop', prevent);
    return () => {
      window.removeEventListener('dragover', prevent);
      window.removeEventListener('drop', prevent);
    };
  }, []);

  function syncFromInput() {
    const f = inputRef.current?.files;
    setNames(f ? Array.from(f).map((x) => x.name) : []);
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    if (inputRef.current && e.dataTransfer.files.length > 0) {
      inputRef.current.files = e.dataTransfer.files;
      syncFromInput();
    }
  }

  const big = variant === 'large';

  return (
    <form
      ref={formRef}
      action={async (fd) => {
        await formAction(fd);
        formRef.current?.reset();
        setNames([]);
      }}
      className="space-y-3"
    >
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
        <input
          ref={inputRef}
          type="file"
          name="file"
          accept={accept}
          multiple
          className="hidden"
          onChange={syncFromInput}
        />
        {names.length === 0 ? (
          <div className="flex flex-col items-center gap-3 text-gray-500">
            <CloudIcon className={`${big ? 'h-11 w-11' : 'h-8 w-8'} text-gray-400`} />
            <div className={`${big ? 'text-base' : 'text-sm'} font-medium text-gray-700`}>Drag and drop files here</div>
            <div className="text-xs text-gray-400">— or —</div>
            <span className="inline-flex items-center gap-2 rounded-full border-2 border-brand-500 px-5 py-2 text-sm font-semibold text-brand-700">
              <CloudIcon className="h-4 w-4" /> Choose file
            </span>
            <div className="text-xs text-gray-400">PDF, JPG, PNG, HEIC, or WEBP</div>
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
      <div className="flex items-center gap-3">
        <SubmitButton label={label} disabled={names.length === 0} />
        {names.length > 0 && (
          <button
            type="button"
            className="text-xs text-gray-400 hover:text-gray-600"
            onClick={() => {
              formRef.current?.reset();
              setNames([]);
            }}
          >
            Clear
          </button>
        )}
        {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
