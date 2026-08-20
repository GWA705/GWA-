'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { saveCostsAction } from '@/app/(admin)/actions';
import type { CostConfig } from '@/lib/costs';

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Saving…' : 'Save cost settings'}
    </button>
  );
}

function Money({
  name,
  label,
  value,
  hint,
  step = '0.01',
}: {
  name: keyof CostConfig;
  label: string;
  value: number;
  hint?: string;
  step?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
        <input
          id={name}
          name={name}
          type="number"
          min="0"
          step={step}
          defaultValue={value}
          className="input pl-6 tabular-nums"
          inputMode="decimal"
        />
      </div>
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

export function CostsForm({ cfg }: { cfg: CostConfig }) {
  const [state, action] = useFormState(
    saveCostsAction,
    {} as { error?: string; ok?: boolean; message?: string },
  );

  return (
    <form action={action} className="space-y-6">
      {state.error && <div className="rounded-md bg-red-50 p-2 text-sm text-red-700">{state.error}</div>}
      {state.ok && <div className="rounded-md bg-green-50 p-2 text-sm text-green-700">{state.message}</div>}

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-gray-900">Google API rates (per 1,000 requests)</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Money name="googleAutocompletePer1000" label="Autocomplete" value={cfg.googleAutocompletePer1000} />
          <Money name="googleDetailsPer1000" label="Details" value={cfg.googleDetailsPer1000} />
          <Money
            name="googleFreeCredit"
            label="Monthly free credit"
            value={cfg.googleFreeCredit}
            hint="If Google gives you a recurring credit."
          />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-gray-900">Fixed monthly bills</legend>
        <p className="text-xs text-amber-700">
          These are estimates to get you a ballpark — enter your real bill amounts.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Money name="render" label="Render hosting" value={cfg.render} step="0.01" />
          <Money name="awsRds" label="AWS database (RDS, Canada)" value={cfg.awsRds} step="0.01" />
          <Money name="awsS3" label="AWS document storage (S3)" value={cfg.awsS3} step="0.01" />
          <Money name="email" label="Email (SMTP)" value={cfg.email} step="0.01" />
          <Money name="domain" label="Domain / DNS" value={cfg.domain} step="0.01" />
        </div>
      </fieldset>

      <SaveButton />
    </form>
  );
}
