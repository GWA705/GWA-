'use client';

import { useTransition } from 'react';
import { toggleItemActiveAction, deleteItemAction } from './actions';

export function ItemRowActions({ id, active }: { id: string; active: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => toggleItemActiveAction(id))}
        className="btn-secondary text-xs"
      >
        {active ? 'Hide' : 'Show'}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirm('Remove this item? Past orders are kept; if it was ever ordered it will just be hidden.')) {
            start(() => deleteItemAction(id));
          }
        }}
        className="btn-secondary text-xs text-red-600"
      >
        Delete
      </button>
    </div>
  );
}
