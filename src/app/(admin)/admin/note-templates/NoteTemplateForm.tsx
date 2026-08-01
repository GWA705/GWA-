'use client';

import { useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { createNoteTemplateAction } from '@/app/(admin)/actions';

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Adding…' : 'Add template'}
    </button>
  );
}

export function NoteTemplateForm() {
  const [state, action] = useFormState(createNoteTemplateAction, {} as { error?: string; ok?: boolean });
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      action={async (fd) => {
        await action(fd);
        ref.current?.reset();
      }}
      className="space-y-3"
    >
      <div>
        <label className="label" htmlFor="label">Label (the button text)</label>
        <input id="label" name="label" maxLength={60} required className="input" placeholder="Missing void cheque" />
      </div>
      <div>
        <label className="label" htmlFor="body">Note text (what gets inserted)</label>
        <textarea id="body" name="body" rows={2} maxLength={1000} required className="input" placeholder="We still need a void cheque or PAP form to fund this deal. Please upload it under the funding package." />
      </div>
      <div className="flex items-center gap-3">
        <AddButton />
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
