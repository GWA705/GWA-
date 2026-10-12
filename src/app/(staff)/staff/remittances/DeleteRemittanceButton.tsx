'use client';

import { useT } from '@/i18n/client';
import { deleteRemittanceAction } from './actions';

export function DeleteRemittanceButton({ id, docNumber }: { id: string; docNumber: string | null }) {
  const t = useT();
  return (
    <form
      action={deleteRemittanceAction.bind(null, id)}
      onSubmit={(e) => {
        if (
          !confirm(t('remit.delete.confirm', { doc: docNumber ?? t('remit.manualTag') }))
        ) {
          e.preventDefault();
        }
      }}
    >
      <button type="submit" className="btn-secondary text-sm !text-red-700 hover:!bg-red-50">
        {t('remit.delete.button')}
      </button>
    </form>
  );
}
