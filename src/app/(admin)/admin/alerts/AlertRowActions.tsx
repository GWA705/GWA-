'use client';

import { toggleDealerAlertActiveAction, deleteDealerAlertAction } from '@/app/(admin)/actions';

export function AlertRowActions({ id, title, active }: { id: string; title: string; active: boolean }) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <form action={toggleDealerAlertActiveAction.bind(null, id)}>
        <button type="submit" className="btn-secondary text-xs">
          {active ? 'Deactivate' : 'Activate'}
        </button>
      </form>
      <form
        action={deleteDealerAlertAction.bind(null, id)}
        onSubmit={(e) => {
          if (!window.confirm(`Delete the pop-up “${title}”? This also clears its read receipts.`)) {
            e.preventDefault();
          }
        }}
      >
        <button type="submit" className="btn-danger text-xs">Delete</button>
      </form>
    </div>
  );
}
