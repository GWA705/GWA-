'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cancelGiftCardRequestAction } from './actions';

export function CancelGiftCardButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm('Cancel this gift-card request?')) return;
        start(async () => {
          await cancelGiftCardRequestAction(id);
          router.refresh();
        });
      }}
      className="text-xs font-medium text-gray-500 hover:text-red-600 disabled:opacity-50"
    >
      {pending ? '…' : 'Cancel'}
    </button>
  );
}
