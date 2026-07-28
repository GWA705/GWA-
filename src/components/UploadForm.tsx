'use client';

import { useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

export interface UploadState {
  error?: string;
}
type BoundUploadAction = (prev: UploadState, formData: FormData) => Promise<UploadState>;

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-secondary text-xs" disabled={pending}>
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
  const ref = useRef<HTMLFormElement>(null);

  return (
    <form ref={ref} action={formAction} className="flex items-center gap-2">
      <input
        type="file"
        name="file"
        accept={accept}
        multiple
        required
        className="block w-full text-xs text-gray-600 file:mr-3 file:rounded file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-brand-700 hover:file:bg-brand-100"
      />
      <SubmitButton label={label} />
      {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
