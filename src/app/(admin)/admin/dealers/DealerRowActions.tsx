'use client';

import { toggleDealerActiveAction, deleteDealerAction, viewAsDealerAction } from '@/app/(admin)/actions';

export function DealerRowActions({
  id,
  name,
  active,
  canDelete,
}: {
  id: string;
  name: string;
  active: boolean;
  canDelete: boolean;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <form action={viewAsDealerAction.bind(null, id)}>
        <button
          type="submit"
          className="btn-secondary text-xs"
          title="Open this dealer's portal exactly as they see it, to troubleshoot an issue. Your access is logged."
        >
          View as
        </button>
      </form>
      <form action={toggleDealerActiveAction.bind(null, id)}>
        <button type="submit" className="btn-secondary text-xs">
          {active ? 'Archive' : 'Unarchive'}
        </button>
      </form>
      {canDelete ? (
        <form
          action={deleteDealerAction.bind(null, id)}
          onSubmit={(e) => {
            if (!window.confirm(`Delete “${name}” permanently? This cannot be undone.`)) {
              e.preventDefault();
            }
          }}
        >
          <button type="submit" className="btn-danger text-xs">Delete</button>
        </form>
      ) : (
        <span
          className="cursor-help text-xs text-gray-400"
          title="Only dealers with no users and no applications can be deleted. Archive this dealer instead."
        >
          Archive only
        </span>
      )}
    </div>
  );
}
