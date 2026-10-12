'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { flagDealerIssueAction } from '@/app/(staff)/actions';
import { useT } from '@/i18n/client';

/**
 * Confirmation-step action: when a confirmer finds the customer has a question or
 * concern on the call, flag it to the dealer. Expands to a message box; sending
 * posts a dealer-visible note on the deal (stays in the portal, on the customer's
 * file), marks the confirmation as an issue, and emails + notifies the office so
 * they review it. The dealer replies on their copy of the deal, so the whole
 * exchange is tracked here.
 */
export function FlagDealerIssueCard({ applicationId }: { applicationId: string }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  function send() {
    setMsg(null);
    start(async () => {
      const r = await flagDealerIssueAction(applicationId, body);
      if (r.error) { setMsg({ kind: 'err', text: r.error }); return; }
      setBody('');
      setOpen(false);
      const emailed = typeof r.notified === 'number'
        ? (r.notified > 0
            ? t(r.notified === 1 ? 'staffCards.flagIssue.emailedContactsOne' : 'staffCards.flagIssue.emailedContactsMany', { n: r.notified })
            : t('staffCards.flagIssue.noContactsEmailed'))
        : '';
      setMsg({ kind: 'ok', text: t('staffCards.flagIssue.issueSent', { emailed }) });
      router.refresh();
    });
  }

  return (
    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/40 p-4">
      {!open ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <button
              type="button"
              onClick={() => { setOpen(true); setMsg(null); }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-amber-700"
            >
              <span aria-hidden>⚠</span> {t('staffCards.flagIssue.openButton')}
            </button>
            <p className="mt-1 text-xs text-gray-500">{t('staffCards.flagIssue.openHint')}</p>
          </div>
        </div>
      ) : (
        <div>
          <label htmlFor="issueBody" className="block text-sm font-semibold text-amber-900">{t('staffCards.flagIssue.promptLabel')}</label>
          <p className="mb-1.5 text-xs text-amber-700">{t('staffCards.flagIssue.promptHint')}</p>
          <textarea
            id="issueBody"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder={t('staffCards.flagIssue.bodyPlaceholder')}
            className="input w-full text-sm"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={send}
              disabled={pending || body.trim().length < 3}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {pending ? t('common.sending') : t('staffCards.flagIssue.sendButton')}
            </button>
            <button type="button" onClick={() => { setOpen(false); setMsg(null); }} className="px-2 py-2 text-sm text-gray-500 hover:underline">
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {msg && (
        <p className={`mt-3 rounded-md border-l-4 p-2 text-xs ${msg.kind === 'ok' ? 'border-green-500 bg-green-50 text-green-800' : 'border-red-500 bg-red-50 text-red-800'}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
