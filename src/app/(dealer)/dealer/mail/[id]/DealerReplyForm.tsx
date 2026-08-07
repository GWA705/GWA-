'use client';

import { useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { postDealerMailReplyAction, type MailReplyState } from '../actions';

function SendButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Sending…' : 'Send reply'}
    </button>
  );
}

export function DealerReplyForm({ mailId }: { mailId: string }) {
  const [state, action] = useFormState<MailReplyState, FormData>(
    postDealerMailReplyAction.bind(null, mailId),
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
      className="space-y-2"
    >
      {state.error && <div className="rounded-md bg-red-50 p-2 text-sm text-red-700">{state.error}</div>}
      <textarea
        name="body"
        rows={3}
        maxLength={5000}
        required
        placeholder="Write a reply to GWA…"
        className="input"
      />
      <div className="flex justify-end">
        <SendButton />
      </div>
    </form>
  );
}
