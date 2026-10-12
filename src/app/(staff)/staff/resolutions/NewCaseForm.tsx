'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { createCaseAction, summarizeEmailAction, type CaseFormState } from './actions';
import { PRIORITIES } from '@/lib/resolutionStatus';
import { useT } from '@/i18n/client';

function SubmitBtn() {
  const { pending } = useFormStatus();
  const t = useT();
  return <button type="submit" className="btn-primary" disabled={pending}>{pending ? t('resolution.newCase.opening') : t('resolution.newCase.openCase')}</button>;
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
  const t = useT();
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
      setSumErr(t('resolution.newCase.summarizeError'));
    } finally {
      setSummarizing(false);
    }
  }

  return (
    <form action={action} className="card p-5 space-y-3">
      {state.error && <div className="rounded-md bg-red-50 p-2 text-sm text-red-700">{state.error}</div>}
      {gmailThreadId && <input type="hidden" name="gmailThreadId" value={gmailThreadId} />}
      {gmailThreadId && <div className="rounded-md bg-sky-50 p-2 text-xs text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">📧 {t('resolution.newCase.emailLinkedNote')}</div>}

      {/* Matched deal — linked for its office + documents, but you can unlink. */}
      {linkedDeal && (
        <div className="rounded-md bg-emerald-50 p-2 text-xs dark:bg-emerald-900/30">
          {keepLink && <input type="hidden" name="applicationId" value={linkedDeal.applicationId} />}
          {keepLink ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-emerald-800 dark:text-emerald-200">
                ✓ {t('resolution.newCase.linkedPre')}<strong>{linkedDeal.customerName}</strong>{t('resolution.newCase.linkedPost', { office: linkedDeal.officeName })}
              </span>
              <button type="button" onClick={() => setKeepLink(false)} className="shrink-0 font-medium text-emerald-700 underline hover:no-underline dark:text-emerald-300">{t('resolution.email.unlink')}</button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-gray-600 dark:text-slate-300">{t('resolution.newCase.linkRemoved')}</span>
              <button type="button" onClick={() => setKeepLink(true)} className="shrink-0 font-medium text-emerald-700 underline hover:no-underline dark:text-emerald-300">{t('resolution.newCase.relink')}</button>
            </div>
          )}
        </div>
      )}

      {/* Customer details — always editable; pre-filled from the deal or the email. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="customerName">{t('resolution.newCase.customerName')}</label>
          <input id="customerName" name="customerName" required className="input" placeholder="Jane Smith" defaultValue={prefillCustomerName ?? ''} />
        </div>
        <div>
          <label className="label" htmlFor="customerPhone">{t('resolution.newCase.customerPhone')}</label>
          <input id="customerPhone" name="customerPhone" className="input" placeholder="705-555-0148" defaultValue={prefillCustomerPhone ?? ''} />
        </div>
        <div>
          <label className="label" htmlFor="hdReference">{t('resolution.newCase.hdRef')}</label>
          <input id="hdReference" name="hdReference" className="input" placeholder="800255118" defaultValue={prefillHdRef ?? ''} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="title">{t('resolution.newCase.titleLabel')}</label>
          <input id="title" name="title" required className="input" placeholder={t('resolution.newCase.titlePlaceholder')} defaultValue={prefillTitle ?? ''} />
        </div>
        <div>
          <label className="label" htmlFor="hdCaseNumber">{t('resolution.newCase.hdCase')} <span className="font-normal text-gray-400">{t('resolution.newCase.hdCaseHint')}</span></label>
          <input id="hdCaseNumber" name="hdCaseNumber" className="input" placeholder="08210415" defaultValue={prefillHdCase ?? ''} />
        </div>
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="label" htmlFor="description">{t('resolution.newCase.problem')}</label>
          {gmailThreadId && aiAvailable && (
            <button type="button" onClick={summarize} disabled={summarizing} className="text-xs font-medium text-brand-700 hover:underline disabled:opacity-50 dark:text-sky-300">
              {summarizing ? `✨ ${t('resolution.newCase.summarizing')}` : `✨ ${t('resolution.newCase.summarize')}`}
            </button>
          )}
        </div>
        <textarea
          id="description"
          name="description"
          rows={5}
          required
          className="input"
          placeholder={t('resolution.newCase.problemPlaceholder')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        {sumErr && <p className="mt-1 text-xs text-amber-600">{sumErr}</p>}
        {gmailThreadId && aiAvailable && !sumErr && (
          <p className="mt-1 text-xs text-gray-400">{t('resolution.newCase.summarizeTip')}</p>
        )}
      </div>

      <div className="max-w-[200px]">
        <label className="label" htmlFor="priority">{t('resolution.caseFile.priority')}</label>
        <select id="priority" name="priority" defaultValue="normal" className="input">
          {PRIORITIES.map((p) => <option key={p} value={p}>{t(`resolution.newCase.priority.${p}`)}</option>)}
        </select>
      </div>

      <div className="flex justify-end"><SubmitBtn /></div>
    </form>
  );
}
