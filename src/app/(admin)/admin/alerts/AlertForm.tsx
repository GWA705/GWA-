'use client';

import { useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { createDealerAlertAction, type ActionState } from '@/app/(admin)/actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary text-sm" disabled={pending}>
      {pending ? 'Publishing…' : 'Publish pop-up'}
    </button>
  );
}

export function AlertForm({ dealers }: { dealers: { id: string; name: string }[] }) {
  const [state, action] = useFormState(createDealerAlertAction, {} as ActionState);
  const formRef = useRef<HTMLFormElement>(null);
  if (state?.ok) formRef.current?.reset();

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <div>
        <label className="label" htmlFor="title">Title</label>
        <input id="title" name="title" className="input" placeholder="e.g. Civic Holiday Hours" maxLength={160} required />
      </div>
      <div>
        <label className="label" htmlFor="body">Message</label>
        <textarea id="body" name="body" className="input" rows={4} placeholder="The information dealers must read…" maxLength={4000} required />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="linkUrl">Link (optional)</label>
          <input id="linkUrl" name="linkUrl" className="input" placeholder="https://…" maxLength={500} />
        </div>
        <div>
          <label className="label" htmlFor="dealerId">Show to</label>
          <select id="dealerId" name="dealerId" className="input" defaultValue="">
            <option value="">All dealers</option>
            {dealers.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <SubmitButton />
        {state?.ok && <span className="text-xs text-green-600">Published — dealers will see it on their next visit.</span>}
        {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
      </div>
      <p className="text-xs text-gray-500">
        Dealers must press X to close it, and that acknowledgement is recorded. It shows once per
        person until they dismiss it.
      </p>
    </form>
  );
}
