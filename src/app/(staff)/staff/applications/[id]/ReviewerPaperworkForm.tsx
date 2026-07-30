'use client';

import { useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

interface UploadState {
  error?: string;
}
type BoundAction = (prev: UploadState, formData: FormData) => Promise<UploadState>;

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary text-sm" disabled={pending || disabled}>
      {pending ? 'Uploading…' : 'Upload'}
    </button>
  );
}

/**
 * One drop zone for all reviewer→dealer paperwork. The reviewer picks a category
 * from the dropdown, then drops/chooses the file(s). Replaces the old four
 * separate upload boxes.
 */
export function ReviewerPaperworkForm({
  action,
  categories,
  accept = '.pdf,.jpg,.jpeg,.png,.heic,.webp',
}: {
  action: BoundAction;
  categories: { type: string; label: string }[];
  accept?: string;
}) {
  const [state, formAction] = useFormState(action, {} as UploadState);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [names, setNames] = useState<string[]>([]);
  const [category, setCategory] = useState('');
  const [dragging, setDragging] = useState(false);

  function syncFromInput() {
    const f = inputRef.current?.files;
    setNames(f ? Array.from(f).map((x) => x.name) : []);
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    if (inputRef.current && e.dataTransfer.files.length > 0) {
      inputRef.current.files = e.dataTransfer.files;
      syncFromInput();
    }
  }

  const ready = !!category && names.length > 0;

  return (
    <form
      ref={formRef}
      action={async (fd) => {
        await formAction(fd);
        formRef.current?.reset();
        setNames([]);
        setCategory('');
      }}
      className="space-y-3"
    >
      <div>
        <label className="label" htmlFor="paperworkCategory">Paperwork type</label>
        <select
          id="paperworkCategory"
          name="category"
          className="input max-w-md"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Choose a type…</option>
          {categories.map((c) => (
            <option key={c.type} value={c.type}>{c.label}</option>
          ))}
        </select>
      </div>

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
        className={`cursor-pointer rounded-md border-2 border-dashed bg-white px-4 py-6 text-center text-sm transition ${
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
            <span className="font-medium text-brand-700">Click to choose</span> or drag &amp; drop file(s) here
          </span>
        ) : (
          <span className="text-gray-700">
            {names.length} file{names.length > 1 ? 's' : ''} ready: {names.join(', ')}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton disabled={!ready} />
        {names.length > 0 && (
          <button
            type="button"
            className="text-xs text-gray-400 hover:text-gray-600"
            onClick={() => {
              formRef.current?.reset();
              setNames([]);
              setCategory('');
            }}
          >
            Clear
          </button>
        )}
        {!ready && names.length > 0 && !category && (
          <span className="text-xs text-amber-600">Pick a paperwork type above.</span>
        )}
        {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
