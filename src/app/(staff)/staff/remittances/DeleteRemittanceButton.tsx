'use client';

import { deleteRemittanceAction } from './actions';

export function DeleteRemittanceButton({ id, docNumber }: { id: string; docNumber: string | null }) {
  return (
    <form
      action={deleteRemittanceAction.bind(null, id)}
      onSubmit={(e) => {
        if (
          !confirm(
            `Delete remittance ${docNumber ?? '(manual)'}?\n\nThis removes the record and its lines. Deals that were already funded stay funded — this only clears the remittance bookkeeping. Use it to remove a duplicate or a mistaken entry.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <button type="submit" className="btn-secondary text-sm !text-red-700 hover:!bg-red-50">
        Delete remittance
      </button>
    </form>
  );
}
