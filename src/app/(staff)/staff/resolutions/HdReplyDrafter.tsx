'use client';

import { useState } from 'react';
import { draftHdReplyAction } from './actions';

/**
 * "Draft reply to HD" — turns the case's notes (+ HD's latest email when linked)
 * into a professional reply via AI, for the staffer to review, edit, and copy
 * into Gmail. The portal's Gmail is read-only, so it drafts rather than sends.
 */
export function HdReplyDrafter({ caseId }: { caseId: string }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function draft() {
    setLoading(true);
    setErr(null);
    setCopied(false);
    try {
      const r = await draftHdReplyAction(caseId);
      if (r.error) setErr(r.error);
      else setText(r.text ?? '');
    } catch {
      setErr('Couldn’t draft right now — try again.');
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked — select the text so the staffer can copy manually.
      const el = document.getElementById(`hd-reply-${caseId}`) as HTMLTextAreaElement | null;
      el?.select();
    }
  }

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100">✉️ Draft reply to HD</h2>
        <button
          type="button"
          onClick={draft}
          disabled={loading}
          className="text-xs font-medium text-brand-700 hover:underline disabled:opacity-50 dark:text-sky-300"
        >
          {loading ? '✨ Drafting…' : text ? '✨ Re-draft from notes' : '✨ Draft from notes'}
        </button>
      </div>
      <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
        Turns this case&apos;s notes (and HD&apos;s latest email) into a professional reply. Review and edit it, then copy
        it into your Gmail reply — nothing is sent from here.
      </p>
      {err && <p className="mt-2 text-xs text-amber-600">{err}</p>}
      {text && (
        <>
          <textarea
            id={`hd-reply-${caseId}`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            className="input mt-3 font-mono text-[13px] leading-relaxed"
          />
          <div className="mt-2 flex justify-end">
            <button type="button" onClick={copy} className="btn-secondary text-sm">
              {copied ? '✓ Copied' : 'Copy reply'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
