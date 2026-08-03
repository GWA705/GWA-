'use client';

import { useTransition } from 'react';
import { toggleCategoryActiveAction, deleteCategoryAction } from './actions';

export function CategoryRowActions({ id, active }: { id: string; active: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => toggleCategoryActiveAction(id))}
        className="btn-secondary text-xs"
      >
        {active ? 'Hide' : 'Show'}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirm('Delete this category? Items in it are kept and simply become Uncategorized.')) {
            start(() => deleteCategoryAction(id));
          }
        }}
        className="btn-secondary text-xs text-red-600"
      >
        Delete
      </button>
    </div>
  );
}
