'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { createCaseAction, summarizeEmailAction, type CaseFormState } from './actions';
import { PRIORITIES } from '@/lib/resolutionStatus';

function SubmitBtn() {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn-primary" disabled={pending}>{pending ? 'Opening…' : 'Open case'}</button>;
}

export function NewCaseForm({
  linkedDeal,
  gmailThreadId,
  aiAvailable,
  prefillTitle,
  prefillHdCase,
  prefillCustomerName,
  prefillCustomerPhone,
  prefillHdRef,
}: {
  // A matched existing deal (by HD Ref #) — its documents/office come with it.
  linkedDeal: { applicationId: string; customerName: string; officeName: string } | null;
  gmailThreadId?: string;
  aiAvailable?: boolean; // AI configured — show the "Summarize" button
  prefillTitle?: string;
  prefillHdCase?: string;
  // Editable field pre-fills (from the matched deal, or parsed from the email).
  prefillCustomerName?: string;
  prefillCustomerPhone?: string;
  prefillHdRef?: string;
}) {
  const [state, action] = useFormState(createCaseAction, {} as CaseFormState);
  // The deal link is kept by default, but can be removed (the case is then not
  // tied to that customer's file).
  const [keepLink, setKeepLink] = useState(true);
  // The Problem box is controlled so the AI summary can be dropped in.
  const [description, setDescription] = useState('');
  const [summarizing, setSummarizing] = useState(false);
  const [sumErr, setSumErr] = useState<string | null>(null);

  async function summarize() {
    if (!gmailThreadId) return;
    setSummarizing(true);
    setSumErr(null);
    try {
      const r = await summarizeEmailAction(gmailThreadId);
      if (r.error) setSumErr(r.error);
      else setDescription(r.text ?? '');
    } catch {
      setSumErr('Couldn’t summarize right now — try again.');
    } finally {
      setSummarizing(false);
    }
  }

  return (
    <form action={action} className="card p-5 space-y-3">
      {state.error && <div className="rounded-md bg-red-50 p-2 text-sm text-red-700">{state.error}</div>}
      {gmailThreadId && <input type="hidden" name="gmailThreadId" value={gmailThreadId} />}
      {gmailThreadId && <div className="rounded-md bg-sky-50 p-2 text-xs text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">📧 This case will be linked to the selected HD email thread.</div>}

      {/* Matched deal — linked for its office + documents, but you can unlink. */}
      {linkedDeal && (
        <div className="rounded-md bg-emerald-50 p-2 text-xs dark:bg-emerald-900/30">
          {keepLink && <input type="hidden" name="applicationId" value={linkedDeal.applicationId} />}
          {keepLink ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-emerald-800 dark:text-emerald-200">
                ✓ Linked to <strong>{linkedDeal.customerName}</strong>&apos;s deal · 🏬 {linkedDeal.officeName} — its office &amp; documents come with the case.
              </span>
              <button type="button" onClick={() => setKeepLink(false)} className="shrink-0 font-medium text-emerald-700 underline hover:no-underline dark:text-emerald-300">Unlink</button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-gray-600 dark:text-slate-300">Deal link removed — this case won&apos;t be tied to the customer&apos;s file.</span>
              <button type="button" onClick={() => setKeepLink(true)} className="shrink-0 font-medium text-emerald-700 underline hover:no-underline dark:text-emerald-300">Re-link</button>
            </div>
          )}
        </div>
      )}

      {/* Customer details — always editable; pre-filled from the deal or the email. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="customerName">Customer name</label>
          <input id="customerName" name="customerName" required className="input" placeholder="Jane Smith" defaultValue={prefillCustomerName ?? ''} />
        </div>
        <div>
          <label className="label" htmlFor="customerPhone">Customer phone</label>
          <input id="customerPhone" name="customerPhone" className="input" placeholder="705-555-0148" defaultValue={prefillCustomerPhone ?? ''} />
        </div>
        <div>
          <label className="label" htmlFor="hdReference">HD Ref #</label>
          <input id="hdReference" name="hdReference" className="input" placeholder="800255118" defaultValue={prefillHdRef ?? ''} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="title">Title</label>
          <input id="title" name="title" required className="input" placeholder="e.g. Leak — RO drinking water system" defaultValue={prefillTitle ?? ''} />
        </div>
        <div>
          <label className="label" htmlFor="hdCaseNumber">HD Case # <span className="font-normal text-gray-400">(for the email link)</span></label>
          <input id="hdCaseNumber" name="hdCaseNumber" className="input" placeholder="08210415" defaultValue={prefillHdCase ?? ''} />
        </div>
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="label" htmlFor="description">Problem</label>
          {gmailThreadId && aiAvailable && (
            <button type="button" onClick={summarize} disabled={summarizing} className="text-xs font-medium text-brand-700 hover:underline disabled:opacity-50 dark:text-sky-300">
              {summarizing ? '✨ Summarizing…' : '✨ Summarize the HD email'}
            </button>
          )}
        </div>
        <textarea
          id="description"
          name="description"
          rows={5}
          required
          className="input"
          placeholder="What did Home Depot / the customer report? What needs to happen?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        {sumErr && <p className="mt-1 text-xs text-amber-600">{sumErr}</p>}
        {gmailThreadId && aiAvailable && !sumErr && (
          <p className="mt-1 text-xs text-gray-400">Tip: “Summarize the HD email” drafts this from the first email — then edit as needed.</p>
        )}
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
