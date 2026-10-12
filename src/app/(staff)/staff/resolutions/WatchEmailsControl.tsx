'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { saveWatchEmailsAction } from './actions';
import { useT } from '@/i18n/client';

function SaveBtn() {
  const { pending } = useFormStatus();
  const t = useT();
  return <button type="submit" className="btn-secondary text-xs" disabled={pending}>{pending ? t('common.saving') : t('resolution.watch.saveBtn')}</button>;
}

export function WatchEmailsControl({
  caseId, watchEmails, customerEmail,
}: {
  caseId: string;
  watchEmails: string[];
  customerEmail: string | null;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState(saveWatchEmailsAction, {} as { ok?: boolean; error?: string });

  return (
    <div className="mt-3 rounded-lg border border-gray-200 bg-slate-50/60 p-3 text-sm dark:border-slate-700 dark:bg-slate-900/40">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-medium text-gray-800 dark:text-slate-200">{t('resolution.watch.alsoParsing')}</span>
        {customerEmail && (
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-xs text-gray-600 ring-1 ring-gray-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600">
            {customerEmail} <span className="text-gray-400">· {t('resolution.watch.customerAuto')}</span>
          </span>
        )}
        {watchEmails.map((e) => (
          <span key={e} className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-xs text-gray-600 ring-1 ring-gray-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600">{e}</span>
        ))}
        {!customerEmail && watchEmails.length === 0 && <span className="text-gray-400 dark:text-slate-500">{t('resolution.watch.threadOnly')}</span>}
        <button type="button" onClick={() => setOpen((v) => !v)} className="ml-auto text-xs font-medium text-brand-700 hover:underline dark:text-sky-300">
          {open ? t('common.close') : t('resolution.watch.addEdit')}
        </button>
      </div>

      {open && (
        <form action={action} className="mt-3 space-y-2">
          <input type="hidden" name="caseId" value={caseId} />
          <label className="block text-xs text-gray-500 dark:text-slate-400">
            {t('resolution.watch.extraLabel')}
          </label>
          <textarea
            name="watchEmails"
            defaultValue={watchEmails.join('\n')}
            rows={3}
            placeholder={'customer.personal@email.ca\nhd.contact@homedepot.com'}
            className="input font-mono text-xs"
            autoComplete="off"
          />
          <div className="flex items-center gap-3">
            <SaveBtn />
            {state.error && <span className="text-xs text-red-600">{state.error}</span>}
            {state.ok && <span className="text-xs text-green-600">{t('resolution.watch.savedMsg')}</span>}
          </div>
        </form>
      )}
    </div>
  );
}
