'use client';

import { useFormState, useFormStatus } from 'react-dom';
import {
  updateNoteTemplateAction,
  toggleNoteTemplateActiveAction,
  deleteNoteTemplateAction,
} from '@/app/(admin)/actions';

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-secondary text-xs" disabled={pending}>
      {pending ? 'Saving…' : 'Save'}
    </button>
  );
}

export function NoteTemplateRow({
  template,
}: {
  template: { id: string; label: string; body: string; active: boolean };
}) {
  const [state, action] = useFormState(updateNoteTemplateAction, {} as { error?: string; ok?: boolean });
  return (
    <div className={`rounded-lg border p-4 ${template.active ? 'border-gray-200' : 'border-gray-200 bg-gray-50/60'}`}>
      <form action={action} className="space-y-2">
        <input type="hidden" name="id" value={template.id} />
        <div className="flex flex-wrap items-center gap-2">
          <input name="label" defaultValue={template.label} maxLength={60} required className="input max-w-xs" />
          {!template.active && <span className="badge bg-gray-100 text-gray-600">Archived</span>}
        </div>
        <textarea name="body" defaultValue={template.body} rows={2} maxLength={1000} required className="input" />
        <div className="flex flex-wrap items-center gap-2">
          <SaveButton />
          <button type="submit" formAction={toggleNoteTemplateActiveAction.bind(null, template.id)} className="btn-secondary text-xs">
            {template.active ? 'Archive' : 'Activate'}
          </button>
          <button
            type="submit"
            formAction={deleteNoteTemplateAction.bind(null, template.id)}
            className="btn-danger text-xs"
            onClick={(e) => {
              if (!window.confirm(`Delete the “${template.label}” template?`)) e.preventDefault();
            }}
          >
            Delete
          </button>
          {state.error && <span className="text-xs text-red-600">{state.error}</span>}
          {state.ok && <span className="text-xs text-green-700">Saved.</span>}
        </div>
      </form>
    </div>
  );
}
