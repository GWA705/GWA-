'use client';

import { useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { FileDropInput } from './FileDropInput';

export interface UploadState {
  error?: string;
}
type BoundUploadAction = (prev: UploadState, formData: FormData) => Promise<UploadState>;

export interface UploadCategory {
  value: string;
  label: string;
}
// Sentinel category value that reveals a free-text box for a custom label.
export const OTHER_CATEGORY = 'OTHER';

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
  categories,
}: {
  action: BoundUploadAction;
  label?: string;
  accept?: string;
  variant?: 'large' | 'compact';
  // When provided, the uploader must pick what the document is; choosing "Other"
  // reveals a free-text box. Submitted as `docCategory` + `docCategoryOther`.
  categories?: UploadCategory[];
}) {
  const [state, formAction] = useFormState(action, {} as UploadState);
  const formRef = useRef<HTMLFormElement>(null);
  const [names, setNames] = useState<string[]>([]);
  const [category, setCategory] = useState('');
  const [otherText, setOtherText] = useState('');

  const needsCategory = !!categories && categories.length > 0;
  const categoryMissing = needsCategory && (!category || (category === OTHER_CATEGORY && !otherText.trim()));

  return (
    <form
      ref={formRef}
      action={async (fd) => {
        await formAction(fd);
        formRef.current?.reset();
        setCategory('');
        setOtherText('');
      }}
      className="space-y-3"
    >
      {needsCategory && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="docCategory">What is this document?</label>
            <select
              id="docCategory"
              name="docCategory"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input"
            >
              <option value="">— Choose —</option>
              {categories!.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          {category === OTHER_CATEGORY && (
            <div>
              <label className="label" htmlFor="docCategoryOther">Describe it</label>
              <input
                id="docCategoryOther"
                name="docCategoryOther"
                value={otherText}
                onChange={(e) => setOtherText(e.target.value)}
                placeholder="e.g. Proof of address"
                maxLength={80}
                className="input"
              />
            </div>
          )}
        </div>
      )}

      <FileDropInput name="file" accept={accept} variant={variant} onFilesChange={setNames} />
      <div className="flex items-center gap-3">
        <SubmitButton label={label} disabled={names.length === 0 || categoryMissing} />
        {categoryMissing && names.length > 0 && (
          <span className="text-xs text-gray-400">Choose what the document is first.</span>
        )}
        {names.length > 0 && !categoryMissing && (
          <button type="button" className="text-xs text-gray-400 hover:text-gray-600" onClick={() => { formRef.current?.reset(); setCategory(''); setOtherText(''); }}>
            Clear
          </button>
        )}
        {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
