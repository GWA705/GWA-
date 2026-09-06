'use client';

import { useEffect, useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { createGiftCardRequestAction, type GiftCardActionState } from './actions';
import { useT } from '@/i18n/client';

function SubmitBtn() {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? t('giftCards.submitting') : t('giftCards.requestGiftCard')}
    </button>
  );
}

export function GiftCardForm({ defaultAmount = 25 }: { defaultAmount?: number }) {
  const t = useT();
  const [state, action] = useFormState(createGiftCardRequestAction, {} as GiftCardActionState);
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the form after a successful submit (not on validation errors).
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      {state.error && <div className="rounded-md bg-red-50 p-2 text-sm text-red-700">{state.error}</div>}
      {state.ok && <div className="rounded-md bg-green-50 p-2 text-sm text-green-700">{state.message}</div>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="customerName">{t('giftCards.customerName')}</label>
          <input id="customerName" name="customerName" className="input" autoComplete="off" />
        </div>
        <div>
          <label className="label" htmlFor="customerEmail">{t('giftCards.customerEmail')}</label>
          <input id="customerEmail" name="customerEmail" type="email" className="input" autoComplete="off" placeholder="customer@example.com" />
        </div>
        <div>
          <label className="label" htmlFor="customerPhone">{t('giftCards.customerCell')} <span className="font-normal text-gray-400">{t('giftCards.optional')}</span></label>
          <input id="customerPhone" name="customerPhone" type="tel" className="input" autoComplete="off" placeholder="705-555-0123" />
        </div>
        <div>
          <label className="label" htmlFor="amount">{t('giftCards.cardAmount')}</label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
            <input id="amount" name="amount" type="number" min="1" step="1" defaultValue={defaultAmount} className="input pl-6" />
          </div>
        </div>
      </div>
      <SubmitBtn />
      <p className="text-xs text-gray-400">
        {t('giftCards.sendNote')}
      </p>
    </form>
  );
}
