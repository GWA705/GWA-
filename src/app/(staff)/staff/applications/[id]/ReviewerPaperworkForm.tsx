'use client';

import { useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { FileDropInput } from '@/components/FileDropInput';

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
 * from the dropdown, then drops/chooses the file(s).
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
  const [names, setNames] = useState<string[]>([]);
  const [category, setCategory] = useState('');

  const ready = !!category && names.length > 0;

  return (
    <form
      ref={formRef}
      action={async (fd) => {
        await formAction(fd);
        formRef.current?.reset();
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

      <FileDropInput name="file" accept={accept} onFilesChange={setNames} />

      <div className="flex items-center gap-3">
        <SubmitButton disabled={!ready} />
        {names.length > 0 && (
          <button
            type="button"
            className="text-xs text-gray-400 hover:text-gray-600"
            onClick={() => {
              formRef.current?.reset();
              setCategory('');
            }}
          >
            Clear
          </button>
        )}
        {names.length > 0 && !category && (
          <span className="text-xs text-amber-600">Pick a paperwork type above.</span>
        )}
        {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
