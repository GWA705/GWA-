'use client';

import { useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { postStaffMailReplyAction, type MailActionState } from '../actions';

function SendButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary text-sm" disabled={pending}>
      {pending ? 'Sending…' : 'Reply'}
    </button>
  );
}

export function StaffReplyForm({ mailId, dealerId }: { mailId: string; dealerId: string }) {
  const [state, action] = useFormState<MailActionState, FormData>(
    postStaffMailReplyAction.bind(null, mailId, dealerId),
    {},
  );
  const ref = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={ref}
      action={async (fd) => {
        await action(fd);
        ref.current?.reset();
      }}
      className="mt-2 space-y-2"
    >
      {state.error && <div className="rounded-md bg-red-50 p-2 text-sm text-red-700">{state.error}</div>}
      <textarea
        name="body"
        rows={2}
        maxLength={5000}
        required
        placeholder="Reply to this dealer…"
        className="input text-sm"
      />
      <div className="flex justify-end">
        <SendButton />
      </div>
    </form>
  );
}
