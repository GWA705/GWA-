'use client';

import { useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

export interface NoteTemplateOption {
  label: string;
  body: string;
}

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
  templates,
}: {
  action: BoundNoteAction;
  hidden?: Record<string, string>;
  placeholder?: string;
  label?: string;
  templates?: NoteTemplateOption[];
}) {
  const [state, formAction] = useFormState(action, {} as NoteState);
  const ref = useRef<HTMLFormElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  // Insert a template into the note box: fill it if empty, otherwise append on
  // a new line so a reviewer can stack a couple of common phrases.
  function insert(body: string) {
    const el = textRef.current;
    if (!el) return;
    const current = el.value.trim();
    el.value = current ? `${current}\n${body}` : body;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }

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
      {templates && templates.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="self-center text-xs text-gray-400">Quick notes:</span>
          {templates.map((t, i) => (
            <button
              key={i}
              type="button"
              onClick={() => insert(t.body)}
              title={t.body}
              className="rounded-full border border-gray-300 bg-white px-2.5 py-0.5 text-xs text-gray-700 transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
      <textarea ref={textRef} name="body" required rows={2} className="input" placeholder={placeholder ?? 'Write a note…'} />
      <div className="flex items-center gap-3">
        <SubmitButton label={label} />
        {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
