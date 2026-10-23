'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { reactivateDealAction } from '@/app/(staff)/actions';
import { useT } from '@/i18n/client';

/**
 * Shown on a cancelled (WITHDRAWN) deal: turn it back into an active deal. The
 * reviewer action restores the deal to the status it held before it was
 * withdrawn, records the reversal, and puts the journal row's Result back.
 */
function SubmitBtn() {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <button type="submit" className="btn-secondary text-sm" disabled={pending}>
      {pending ? t('reactivate.working') : t('reactivate.button')}
    </button>
  );
}

export function ReactivateDealCard({ applicationId }: { applicationId: string }) {
  const t = useT();
  const action = reactivateDealAction.bind(null, applicationId);
  const [state, formAction] = useFormState(action, {} as { error?: string; ok?: boolean });
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-2">
        <span aria-hidden>↩️</span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-amber-900">{t('reactivate.title')}</h3>
          <p className="mt-0.5 text-xs text-amber-800">{t('reactivate.hint')}</p>
        </div>
      </div>
      {state.ok ? (
        <p className="mt-2 rounded-md bg-green-50 p-2 text-xs text-green-700">{t('reactivate.done')}</p>
      ) : (
        <form action={formAction} className="mt-3 flex flex-wrap items-end gap-2">
          <input
            name="note"
            className="input h-9 min-w-[220px] flex-1 text-sm"
            placeholder={t('reactivate.reasonPlaceholder')}
            maxLength={2000}
          />
          <SubmitBtn />
          {state.error && <p className="w-full rounded-md bg-red-50 p-2 text-xs text-red-700">{state.error}</p>}
        </form>
      )}
    </div>
  );
}
