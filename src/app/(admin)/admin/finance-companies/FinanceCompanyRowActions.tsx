'use client';

import { toggleFinanceCompanyActiveAction, toggleFinanceCompanySerialAction, deleteFinanceCompanyAction } from '@/app/(admin)/actions';

export function FinanceCompanyRowActions({
  id,
  name,
  active,
  requiresSerial,
  canDelete,
}: {
  id: string;
  name: string;
  active: boolean;
  requiresSerial: boolean;
  canDelete: boolean;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <form action={toggleFinanceCompanySerialAction.bind(null, id)}>
        <button type="submit" className="btn-secondary text-xs" title="Require a serial number for every product on deals through this company">
          {requiresSerial ? 'Serials: On' : 'Serials: Off'}
        </button>
      </form>
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
