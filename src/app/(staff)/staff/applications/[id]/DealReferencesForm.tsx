'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { setDealReferencesAction, type ActionState } from '@/app/(staff)/actions';
import { useT } from '@/i18n/client';

function SubmitButton() {
  const t = useT();
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary text-sm" disabled={pending}>
      {pending ? t('common.saving') : t('common.save')}
    </button>
  );
}

export function DealReferencesForm({
  applicationId,
  financeItNumber,
  hdReference,
  financed,
  hdRequired,
}: {
  applicationId: string;
  financeItNumber: string | null;
  hdReference: string | null;
  // Whether the deal is financed — the Financing deal number is only required then.
  financed: boolean;
  // Whether this is an HD-program deal — the HD Customer # only applies then.
  hdRequired: boolean;
}) {
  const t = useT();
  const [state, action] = useFormState(setDealReferencesAction.bind(null, applicationId), {} as ActionState);
  return (
    <form action={action} className="space-y-3">
      {state.error && <div className="rounded-md bg-red-50 p-2 text-xs text-red-700">{state.error}</div>}
      {state.ok && <div className="rounded-md bg-green-50 p-2 text-xs text-green-700">{t('common.saved')}</div>}
      <div>
        <label className="label" htmlFor="financeItNumber">
          {t('staffDeal.dealNumbers.financingLabel')}{financed ? ' *' : ` ${t('staffDeal.dealNumbers.notRequiredPaid')}`}
        </label>
        <input
          id="financeItNumber"
          name="financeItNumber"
          defaultValue={financeItNumber ?? ''}
          placeholder={financed ? t('staffDeal.dealNumbers.financingPlaceholder') : t('staffDeal.dealNumbers.notRequiredPaidPlaceholder')}
          className="input text-sm"
          autoComplete="off"
        />
      </div>
      <div>
        <label className="label" htmlFor="hdReference">
          {t('staffDeal.dealNumbers.hdLabel')}{hdRequired ? ' *' : ` ${t('staffDeal.dealNumbers.notRequiredGwa')}`}
        </label>
        <input
          id="hdReference"
          name="hdReference"
          defaultValue={hdReference ?? ''}
          placeholder={hdRequired ? t('staffDeal.dealNumbers.hdPlaceholder') : t('staffDeal.dealNumbers.notRequiredGwaPlaceholder')}
          className="input text-sm"
          autoComplete="off"
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-gray-400">
          {t('staffDeal.dealNumbers.footnote')}
        </p>
        <SubmitButton />
      </div>
    </form>
  );
}
