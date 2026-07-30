'use client';

import { toggleFinanceCompanyActiveAction, deleteFinanceCompanyAction } from '@/app/(admin)/actions';

export function FinanceCompanyRowActions({
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
      <form action={toggleFinanceCompanyActiveAction.bind(null, id)}>
        <button type="submit" className="btn-secondary text-xs">
          {active ? 'Archive' : 'Unarchive'}
        </button>
      </form>
      {canDelete ? (
        <form
          action={deleteFinanceCompanyAction.bind(null, id)}
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
          title="Only finance companies with no deals can be deleted. Archive this one instead."
        >
          Archive only
        </span>
      )}
    </div>
  );
}
