'use client';

import { useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { FileDropInput } from './FileDropInput';

export interface UploadState {
  error?: string;
}
type BoundUploadAction = (prev: UploadState, formData: FormData) => Promise<UploadState>;

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
  const [names, setNames] = useState<string[]>([]);

  return (
    <form
      ref={formRef}
      action={async (fd) => {
        await formAction(fd);
        formRef.current?.reset();
      }}
      className="space-y-3"
    >
      <FileDropInput name="file" accept={accept} variant={variant} onFilesChange={setNames} />
      <div className="flex items-center gap-3">
        <SubmitButton label={label} disabled={names.length === 0} />
        {names.length > 0 && (
          <button type="button" className="text-xs text-gray-400 hover:text-gray-600" onClick={() => formRef.current?.reset()}>
            Clear
          </button>
        )}
        {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
