'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cancelGiftCardRequestAction } from './actions';
import { useT } from '@/i18n/client';

export function CancelGiftCardButton({ id }: { id: string }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(t('giftCards.confirmCancel'))) return;
        start(async () => {
          await cancelGiftCardRequestAction(id);
          router.refresh();
        });
      }}
      className="text-xs font-medium text-gray-500 hover:text-red-600 disabled:opacity-50"
    >
      {pending ? '…' : t('giftCards.cancel')}
    </button>
  );
}
