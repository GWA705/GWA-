'use client';

import { useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import type { ActionState } from '@/app/(dealer)/actions';
import { useT } from '@/i18n/client';

type BoundAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <button type="submit" className="btn-secondary text-xs" disabled={pending}>
      {pending ? t('common.adding') : t('dealParts.serial.add')}
    </button>
  );
}

export function SerialNumberForm({ action }: { action: BoundAction }) {
  const t = useT();
  const [state, formAction] = useFormState(action, {} as ActionState);
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      action={async (fd) => {
        await formAction(fd);
        ref.current?.reset();
      }}
      className="flex flex-wrap items-end gap-2"
    >
      <div>
        <label className="label text-xs">{t('dealParts.serial.number')}</label>
        <input name="value" required className="input py-1 text-sm" />
      </div>
      <div>
        <label className="label text-xs">{t('dealParts.serial.productOptional')}</label>
        <input name="productLabel" className="input py-1 text-sm" placeholder={t('dealParts.serial.productPlaceholder')} />
      </div>
      <SubmitButton />
      {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
