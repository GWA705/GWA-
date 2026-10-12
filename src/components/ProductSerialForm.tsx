'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { setProductSerialsAction, type ActionState } from '@/app/(dealer)/actions';
import { useT } from '@/i18n/client';

function SaveButton() {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <button type="submit" className="btn-primary text-sm" disabled={pending}>
      {pending ? t('common.saving') : t('dealParts.serial.saveAll')}
    </button>
  );
}

/**
 * One serial-number field per product the dealer selected — required when the
 * deal's finance company (e.g. UEI) requires a serial for every product.
 */
export function ProductSerialForm({
  applicationId,
  products,
  values,
}: {
  applicationId: string;
  products: string[];
  values: string[];
}) {
  const t = useT();
  const [state, action] = useFormState(setProductSerialsAction.bind(null, applicationId), {} as ActionState);
  return (
    <form action={action} className="space-y-3">
      <div className="rounded-md bg-amber-50 p-2 text-xs text-amber-800">
        {t('dealParts.serial.requiredEach')}
      </div>
      <div className="space-y-3">
        {products.map((p, i) => (
          <div key={i}>
            <label className="label text-xs" htmlFor={`serial_${i}`}>{p}</label>
            <input
              id={`serial_${i}`}
              name={`serial_${i}`}
              defaultValue={values[i] ?? ''}
              required
              className="input py-1 text-sm"
              placeholder={t('dealParts.serial.serialForProduct', { product: p })}
              autoComplete="off"
            />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <SaveButton />
        {state?.ok && <span className="text-xs text-green-600">{t('common.saved')}</span>}
        {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
