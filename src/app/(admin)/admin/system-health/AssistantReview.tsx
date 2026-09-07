'use client';

import { useState, useTransition } from 'react';
import { promoteQaToKnowledge, deleteAssistantQa, listAssistantQa, type QaRow } from './actions';

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/**
 * "What dealers are asking" — the review/promote loop. Shows logged Q&As; one
 * click promotes a good answer into that area's knowledge (so the assistant
 * improves, with admin approval). Filter to gaps (answers it punted on).
 */
export function AssistantReview({ initial }: { initial: QaRow[] }) {
  const [rows, setRows] = useState<QaRow[]>(initial);
  const [gapsOnly, setGapsOnly] = useState(false);
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<{ id: string; ok: boolean; msg: string } | null>(null);

  function refresh(onlyGaps: boolean) {
    startTransition(async () => setRows(await listAssistantQa(onlyGaps)));
  }
  function toggleGaps() {
    const next = !gapsOnly;
    setGapsOnly(next);
    refresh(next);
  }
  function promote(id: string) {
    setNote(null);
    startTransition(async () => {
      const r = await promoteQaToKnowledge(id);
      if (r.ok) {
        setRows((rs) => rs.map((x) => (x.id === id ? { ...x, promoted: true } : x)));
        setNote({ id, ok: true, msg: 'Added to knowledge ✓' });
      } else {
        setNote({ id, ok: false, msg: r.error ?? 'Could not add.' });
      }
    });
  }
  function remove(id: string) {
    startTransition(async () => {
      await deleteAssistantQa(id);
      setRows((rs) => rs.filter((x) => x.id !== id));
    });
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">What dealers are asking</h2>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            <input type="checkbox" checked={gapsOnly} onChange={toggleGaps} className="rounded border-gray-300" />
            Needs an answer only
          </label>
          <button type="button" onClick={() => refresh(gapsOnly)} disabled={pending} className="btn-secondary text-xs disabled:opacity-50">
            {pending ? '…' : 'Refresh'}
          </button>
        </div>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        Every question the assistant answered. <strong>Add to knowledge</strong> promotes a good answer into that area&rsquo;s
        knowledge, so it&rsquo;s used going forward. Items flagged <span className="text-amber-700">Needs answer</span> are where it
        deferred to a teammate — good candidates to fill in.
      </p>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-gray-400">{gapsOnly ? 'No open gaps — nice.' : 'No questions yet. They’ll show here as dealers use the chat.'}</p>
      ) : (
        <ul className="mt-3 divide-y divide-gray-100">
          {rows.map((r) => (
            <li key={r.id} className="py-3">
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
                <span className="badge bg-gray-100 text-gray-600">{r.areaLabel}</span>
                {r.deferred && <span className="badge bg-amber-100 text-amber-800">Needs answer</span>}
                {r.promoted && <span className="badge bg-emerald-100 text-emerald-700">In knowledge</span>}
                <span className="tabular-nums">{timeAgo(r.createdAt)}</span>
              </div>
              <p className="mt-1 text-sm font-semibold text-gray-900">{r.question}</p>
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-gray-600">{r.answer}</p>
              <div className="mt-2 flex items-center gap-3">
                {!r.promoted && (
                  <button type="button" onClick={() => promote(r.id)} disabled={pending} className="btn-primary text-xs disabled:opacity-50">
                    Add to knowledge
                  </button>
                )}
                <button type="button" onClick={() => remove(r.id)} disabled={pending} className="text-xs text-gray-400 hover:text-red-600">
                  Remove
                </button>
                {note?.id === r.id && <span className={`text-xs ${note.ok ? 'text-emerald-600' : 'text-red-600'}`}>{note.msg}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
