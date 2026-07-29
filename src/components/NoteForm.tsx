'use client';

import { useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

interface NoteState {
  error?: string;
  ok?: boolean;
}
type BoundNoteAction = (prev: NoteState, formData: FormData) => Promise<NoteState>;

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-secondary text-sm" disabled={pending}>
      {pending ? 'Saving…' : label}
    </button>
  );
}

export function NoteForm({
  action,
  hidden,
  placeholder,
  label = 'Add note',
}: {
  action: BoundNoteAction;
  hidden?: Record<string, string>;
  placeholder?: string;
  label?: string;
}) {
  const [state, formAction] = useFormState(action, {} as NoteState);
  const ref = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={ref}
      action={async (fd) => {
        await formAction(fd);
        ref.current?.reset();
      }}
      className="space-y-2"
    >
      {hidden &&
        Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <textarea name="body" required rows={2} className="input" placeholder={placeholder ?? 'Write a note…'} />
      <div className="flex items-center gap-3">
        <SubmitButton label={label} />
        {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
