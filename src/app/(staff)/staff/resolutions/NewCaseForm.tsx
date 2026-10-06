'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { createCaseAction, type CaseFormState } from './actions';
import { PRIORITIES } from '@/lib/resolutionStatus';

function SubmitBtn() {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn-primary" disabled={pending}>{pending ? 'Opening…' : 'Open case'}</button>;
}

export function NewCaseForm({
  prefill,
}: {
  prefill: { applicationId: string; customerName: string; officeName: string; hdReference: string | null } | null;
}) {
  const [state, action] = useFormState(createCaseAction, {} as CaseFormState);

  return (
    <form action={action} className="card p-5 space-y-3">
      {state.error && <div className="rounded-md bg-red-50 p-2 text-sm text-red-700">{state.error}</div>}

      {prefill ? (
        <div className="rounded-lg border border-gray-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-700/40">
          <input type="hidden" name="applicationId" value={prefill.applicationId} />
          <div className="font-semibold text-gray-900 dark:text-slate-100">{prefill.customerName}</div>
          <div className="text-gray-600 dark:text-slate-300">🏬 {prefill.officeName}{prefill.hdReference ? ` · HD #${prefill.hdReference}` : ''}</div>
          <div className="mt-1 text-xs text-gray-500 dark:text-slate-400">Linked to this customer&apos;s deal — the office is set automatically.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="customerName">Customer name</label>
            <input id="customerName" name="customerName" required className="input" placeholder="Jane Smith" />
          </div>
          <div>
            <label className="label" htmlFor="customerPhone">Customer phone</label>
            <input id="customerPhone" name="customerPhone" className="input" placeholder="705-555-0148" />
          </div>
          <div>
            <label className="label" htmlFor="hdReference">HD Ref #</label>
            <input id="hdReference" name="hdReference" className="input" placeholder="800255118" />
          </div>
        </div>
      )}

      <div>
        <label className="label" htmlFor="title">Title</label>
        <input id="title" name="title" required className="input" placeholder="e.g. Leak — RO drinking water system" />
      </div>
      <div>
        <label className="label" htmlFor="description">Problem</label>
        <textarea id="description" name="description" rows={4} required className="input" placeholder="What did Home Depot / the customer report? What needs to happen?" />
      </div>
      <div className="max-w-[200px]">
        <label className="label" htmlFor="priority">Priority</label>
        <select id="priority" name="priority" defaultValue="normal" className="input">
          {PRIORITIES.map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}
        </select>
      </div>

      <div className="flex justify-end"><SubmitBtn /></div>
    </form>
  );
}
