'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { submitIdTagAction, type IdTagSubmitState } from './actions';
import { SendTrainingButton } from './SendTrainingButton';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
      className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">
      {pending ? 'Checking…' : 'Submit person'}
    </button>
  );
}

export function IdTagSubmitForm({ trainingLink }: { trainingLink: string | null }) {
  const [state, action] = useFormState(submitIdTagAction, {} as IdTagSubmitState);
  const [copied, setCopied] = useState(false);
  const inputCls = 'w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100';
  const labelCls = 'mb-1 block text-xs font-semibold text-slate-600';

  async function copyLink() {
    if (!trainingLink) return;
    try {
      await navigator.clipboard.writeText(trainingLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked — the link is shown for manual copy */ }
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow-lg shadow-slate-300/30 ring-1 ring-slate-200">
      <h2 className="text-base font-bold text-slate-900">Add a person</h2>
      <p className="mt-0.5 text-sm text-slate-500">We’ll check their training certificate and start the right next step.</p>

      <form action={action} className="mt-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className={labelCls}>First name</span>
            <input name="personFirst" required className={inputCls} placeholder="Jordan" /></label>
          <label className="block"><span className={labelCls}>Last name</span>
            <input name="personLast" required className={inputCls} placeholder="Blake" /></label>
        </div>
        <label className="block"><span className={labelCls}>Active email</span>
          <input name="personEmail" type="email" className={inputCls} placeholder="jordan@email.com" /></label>
        <label className="block"><span className={labelCls}>Cell phone</span>
          <input name="personPhone" className={inputCls} placeholder="705-555-0199" inputMode="tel" /></label>

        <label className="block">
          <span className={labelCls}>Headshot — plain, clean background</span>
          <input name="headshot" type="file" accept="image/*"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-700" />
          <span className="mt-1 block text-[11px] text-amber-700">Optional now — but the card can’t be finished without it, and the person will be delayed until it’s added.</span>
        </label>

        <fieldset className="pt-1">
          <span className="mb-1.5 block text-xs font-semibold text-slate-600">Is this person…</span>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50 has-[:checked]:font-semibold has-[:checked]:text-brand-700">
              <input type="radio" name="kind" value="NEW" defaultChecked className="accent-brand-600" /> Brand new
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50 has-[:checked]:font-semibold has-[:checked]:text-brand-700">
              <input type="radio" name="kind" value="EXISTING" className="accent-brand-600" /> Already has a tag
            </label>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400">Brand-new reps complete training, then get the background-check email; reps who already have a tag are just added to the roster.</p>
        </fieldset>

        <SubmitButton />
      </form>

      {state?.error && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{state.error}</div>
      )}
      {state?.ok && (
        <div className={`mt-3 rounded-xl border p-3 text-sm ${state.needsTraining ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-green-200 bg-green-50 text-green-900'}`}>
          <p>{state.message}</p>
          {state.needsTraining && (
            <div className="mt-3 space-y-2">
              {state.id && state.personEmail && (
                <SendTrainingButton id={state.id} label="Send Home Depot training email" />
              )}
              {trainingLink && (
                <div className="flex items-center gap-2">
                  <code className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap rounded-lg bg-white px-2.5 py-1.5 text-[12px] text-amber-900 ring-1 ring-amber-200">{trainingLink}</code>
                  <button type="button" onClick={copyLink}
                    className="flex-none rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-300 hover:bg-amber-100">{copied ? 'Copied!' : 'Copy link'}</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
