'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { sendMailAction, type MailActionState } from './actions';

const initial: MailActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Sending…' : 'Send mail'}
    </button>
  );
}

export function MailComposeForm({ dealers }: { dealers: { id: string; name: string }[] }) {
  const [state, action] = useFormState(sendMailAction, initial);
  const [allDealers, setAllDealers] = useState(false);

  return (
    <form action={action} className="space-y-5">
      {state.error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {state.error}
        </div>
      )}

      <div>
        <label className="label" htmlFor="subject">Subject</label>
        <input id="subject" name="subject" className="input" maxLength={200} />
      </div>

      <div>
        <label className="label" htmlFor="body">Message</label>
        <textarea id="body" name="body" rows={6} className="input" />
      </div>

      <div>
        <span className="label">Send to</span>
        <label className="mb-2 flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" name="allDealers" checked={allDealers} onChange={(e) => setAllDealers(e.target.checked)} className="h-4 w-4" />
          All dealers
        </label>
        {!allDealers && (
          <div className="mt-1 grid max-h-56 grid-cols-1 gap-1 overflow-y-auto rounded-md border border-gray-200 p-2 sm:grid-cols-2">
            {dealers.length === 0 ? (
              <p className="p-2 text-xs text-gray-400">No active dealers.</p>
            ) : (
              dealers.map((d) => (
                <label key={d.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-gray-50">
                  <input type="checkbox" name="dealerIds" value={d.id} className="h-4 w-4" />
                  <span className="truncate">{d.name}</span>
                </label>
              ))
            )}
          </div>
        )}
      </div>

      <div>
        <label className="label" htmlFor="files">Attachments <span className="font-normal text-gray-400">(PDF or images)</span></label>
        <input id="files" name="files" type="file" multiple accept="application/pdf,image/*" className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100" />
      </div>

      <label className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
        <input type="checkbox" name="requireAck" className="mt-0.5 h-4 w-4" />
        <span>
          <span className="font-medium">Require acknowledgement</span> — ask each dealer user to confirm they&apos;ve read this. Use for sensitive or important information.
        </span>
      </label>

      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}
