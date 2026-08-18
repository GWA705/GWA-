'use client';

import { useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { addResourceFileAction, type ActionState } from '../actions';
import { RESOURCE_FILE_KINDS } from '@/lib/constants';
import { compressImageFile } from '@/lib/clientImageCompress';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary text-sm" disabled={pending}>
      {pending ? 'Uploading…' : 'Add file'}
    </button>
  );
}

export function AddFileForm({ productId }: { productId: string }) {
  const [state, action] = useFormState(addResourceFileAction.bind(null, productId), {} as ActionState);
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={formRef}
      action={async (fd) => {
        // Auto-shrink image uploads in the browser before they're sent (photos
        // and scans). PDFs pass through untouched.
        const f = fd.get('file');
        if (f instanceof File && f.type.startsWith('image/')) {
          const smaller = await compressImageFile(f);
          if (smaller !== f) fd.set('file', smaller);
        }
        await action(fd);
        formRef.current?.reset();
      }}
      className="space-y-3"
    >
      {state.error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{state.error}</div>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="kind">Type</label>
          <select id="kind" name="kind" className="input" defaultValue="MANUAL">
            {RESOURCE_FILE_KINDS.map((k) => (
              <option key={k.value} value={k.value}>{k.label}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="label">Label <span className="font-normal text-gray-400">(optional)</span></label>
          <input id="label" name="label" className="input" placeholder="e.g. Installation manual (EN)" />
        </div>
        <div className="sm:col-span-3">
          <label className="label" htmlFor="file">File <span className="font-normal text-gray-400">(PDF or image, max 40 MB — images are auto-compressed)</span></label>
          <input id="file" name="file" type="file" accept="application/pdf,image/*" required className="input" />
        </div>
      </div>
      <SubmitButton />
    </form>
  );
}
