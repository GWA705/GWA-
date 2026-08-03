'use client';

import { useTransition } from 'react';
import { setDealerTypeAction } from '@/app/(admin)/actions';

/** Inline Distributor/Dealer switcher; saves on change. */
export function DealerTypeSelect({ id, type }: { id: string; type: 'DISTRIBUTOR' | 'DEALER' }) {
  const [pending, start] = useTransition();
  return (
    <select
      defaultValue={type}
      disabled={pending}
      onChange={(e) => {
        const value = e.target.value as 'DISTRIBUTOR' | 'DEALER';
        start(() => setDealerTypeAction(id, value));
      }}
      className="input w-auto py-1 text-xs"
      aria-label="Dealer type"
    >
      <option value="DEALER">Dealer</option>
      <option value="DISTRIBUTOR">Distributor</option>
    </select>
  );
}
