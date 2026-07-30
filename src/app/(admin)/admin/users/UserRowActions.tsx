'use client';

import { toggleUserActiveAction, deleteUserAction } from '@/app/(admin)/actions';

export function UserRowActions({
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
      <form action={toggleUserActiveAction.bind(null, id)}>
        <button type="submit" className="btn-secondary text-xs">
          {active ? 'Archive' : 'Unarchive'}
        </button>
      </form>
      {canDelete ? (
        <form
          action={deleteUserAction.bind(null, id)}
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
          title="Only users with no activity (no deals, documents, notes, or history) can be deleted. Archive this user instead."
        >
          Archive only
        </span>
      )}
    </div>
  );
}
