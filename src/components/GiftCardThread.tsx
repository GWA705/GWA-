'use client';

import { useEffect, useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useT } from '@/i18n/client';
import { AutoTranslate } from './AutoTranslate';

export interface GiftCardNoteVM {
  id: string;
  body: string;
  fromDealer: boolean;
  author: string;
  at: string; // preformatted
}

export type ThreadAddState = { error?: string; ok?: boolean; message?: string };
type AddAction = (prev: ThreadAddState, fd: FormData) => Promise<ThreadAddState>;

function SendBtn() {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <button type="submit" className="btn-secondary shrink-0 text-xs" disabled={pending}>
      {pending ? t('giftCards.sending') : t('giftCards.send')}
    </button>
  );
}

/**
 * The back-and-forth message thread on a single gift-card request. `side` is who
 * is viewing ('dealer' or 'staff') so their own messages align right.
 */
export function GiftCardThread({
  requestId,
  notes,
  side,
  addAction,
}: {
  requestId: string;
  notes: GiftCardNoteVM[];
  side: 'dealer' | 'staff';
  addAction: AddAction;
}) {
  const t = useT();
  const [state, action] = useFormState(addAction, {} as ThreadAddState);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  const viewerIsDealer = side === 'dealer';

  return (
    <div className="space-y-2">
      <div className="space-y-1.5">
        {notes.length === 0 ? (
          <p className="text-xs text-gray-400">{t('giftCards.noMessagesYet')}</p>
        ) : (
          notes.map((n) => {
            const mine = n.fromDealer === viewerIsDealer;
            return (
              <div
                key={n.id}
                className={`max-w-[85%] rounded-lg px-3 py-1.5 text-xs ${mine ? 'ml-auto bg-brand-50 text-gray-800' : 'bg-gray-100 text-gray-700'}`}
              >
                <AutoTranslate text={n.body} />
                <div className="mt-0.5 text-[10px] text-gray-400">
                  {n.fromDealer ? t('giftCards.fromDealer') : t('giftCards.fromTeam')} · {n.author} · {n.at}
                </div>
              </div>
            );
          })
        )}
      </div>
      <form ref={ref} action={action} className="flex items-start gap-2">
        <input type="hidden" name="requestId" value={requestId} />
        <textarea name="body" rows={1} placeholder={t('giftCards.writeMessage')} className="input min-h-[2.25rem] flex-1 text-xs" />
        <SendBtn />
      </form>
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
    </div>
  );
}
