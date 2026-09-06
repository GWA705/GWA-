'use client';

import { useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { postDealerMailReplyAction, type MailReplyState } from '../actions';
import { useT } from '@/i18n/client';
import type { TFunction } from '@/i18n/translator';

function SendButton({ t }: { t: TFunction }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? t('mail.sending') : t('mail.sendReply')}
    </button>
  );
}

export function DealerReplyForm({ mailId }: { mailId: string }) {
  const t = useT();
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
        placeholder={t('mail.replyPlaceholder')}
        className="input"
      />
      <div className="flex justify-end">
        <SendButton t={t} />
      </div>
    </form>
  );
}
