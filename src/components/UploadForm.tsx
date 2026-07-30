'use client';

import { useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

export interface UploadState {
  error?: string;
}
type BoundUploadAction = (prev: UploadState, formData: FormData) => Promise<UploadState>;

function SubmitButton({ label, disabled }: { label: string; disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-secondary text-xs" disabled={pending || disabled}>
      {pending ? 'Uploading…' : label}
    </button>
  );
}

export function UploadForm({
  action,
  label = 'Upload',
  accept = '.pdf,.jpg,.jpeg,.png,.heic,.webp',
}: {
  action: BoundUploadAction;
  label?: string;
  accept?: string;
}) {
  const [state, formAction] = useFormState(action, {} as UploadState);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [names, setNames] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);

  function syncFromInput() {
    const f = inputRef.current?.files;
    setNames(f ? Array.from(f).map((x) => x.name) : []);
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    if (inputRef.current && e.dataTransfer.files.length > 0) {
      // Hand the dropped files to the form's file input so they submit with it.
      inputRef.current.files = e.dataTransfer.files;
      syncFromInput();
    }
  }

  return (
    <form
      ref={formRef}
      action={async (fd) => {
        await formAction(fd);
        formRef.current?.reset();
        setNames([]);
      }}
      className="space-y-2"
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`cursor-pointer rounded-md border-2 border-dashed bg-white px-4 py-3 text-center text-sm transition ${
          dragging ? 'border-brand-500 bg-brand-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
        }`}
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
          <span className="text-gray-500">
            <span className="font-medium text-brand-700">Click to choose</span> or drag &amp; drop
            file(s) here
          </span>
        ) : (
          <span className="text-gray-700">
            {names.length} file{names.length > 1 ? 's' : ''} ready: {names.join(', ')}
          </span>
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
