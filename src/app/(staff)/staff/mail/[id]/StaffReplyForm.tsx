'use client';

import { useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { postStaffMailReplyAction, type MailActionState } from '../actions';
import { useT } from '@/i18n/client';

function SendButton() {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <button type="submit" className="btn-primary text-sm" disabled={pending}>
      {pending ? t('common.sending') : t('staffMisc.mail.reply')}
    </button>
  );
}

export function StaffReplyForm({ mailId, dealerId }: { mailId: string; dealerId: string }) {
  const t = useT();
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
        placeholder={t('staffMisc.mail.replyPlaceholder')}
        className="input text-sm"
      />
      <div className="flex justify-end">
        <SendButton />
      </div>
    </form>
  );
}
