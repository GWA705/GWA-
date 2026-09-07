'use client';

import { useState, useTransition } from 'react';
import { saveAssistantKnowledge } from './actions';

const PLACEHOLDER = `Write the answers, processes and policies you want the assistant to use — in your own words. For example:

• How to process an application: step 1…, step 2…
• Water-test gift cards: who qualifies, how to request, typical timing.
• Common customer questions and the answers you'd give.
• HD payout basics, install booking, warranty, financing terms.
• Tone: friendly, concise, never over-promise.

The assistant treats this as authoritative and answers in your voice. Leave anything you don't want it to speak to out — it will offer to find a teammate instead.`;

/**
 * Admin editor for the AI assistant's team knowledge. Saved to an app setting and
 * injected into the assistant's system prompt on every reply — so editing this is
 * how you "train" the assistant, no deploy required.
 */
export function AssistantKnowledge({ initial }: { initial: string }) {
  const [text, setText] = useState(initial);
  const [saved, setSaved] = useState<string>(initial);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const dirty = text !== saved;

  function save() {
    setStatus(null);
    startTransition(async () => {
      const r = await saveAssistantKnowledge(text);
      if (r.ok) {
        setSaved(text);
        setStatus({ ok: true, msg: 'Saved — the assistant will use this on its next reply.' });
      } else {
        setStatus({ ok: false, msg: r.error ?? 'Could not save.' });
      }
    });
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
      <h2 className="text-sm font-semibold text-gray-900">AI assistant — team knowledge</h2>
      <p className="mt-1 text-xs text-gray-500">
        What the support assistant knows and how it answers. Write it in your own words; it&rsquo;s treated as authoritative and
        used on every reply. Editing here is how you &ldquo;train&rdquo; the assistant — no deploy needed.
      </p>
      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); if (status) setStatus(null); }}
        placeholder={PLACEHOLDER}
        rows={12}
        className="mt-3 w-full resize-y rounded-lg border border-gray-300 p-3 text-sm leading-relaxed focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] text-gray-400 tabular-nums">{text.length.toLocaleString('en-CA')} / 20,000 characters</span>
        <div className="flex items-center gap-3">
          {status && (
            <span className={`text-xs ${status.ok ? 'text-emerald-600' : 'text-red-600'}`}>{status.msg}</span>
          )}
          <button
            type="button"
            onClick={save}
            disabled={pending || !dirty}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {pending ? 'Saving…' : dirty ? 'Save knowledge' : 'Saved'}
          </button>
        </div>
      </div>
    </div>
  );
}
