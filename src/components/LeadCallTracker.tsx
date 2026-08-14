'use client';

import { useState, useTransition } from 'react';
import { logLeadCallAction, deleteLeadCallAction } from '@/lib/leadCallActions';
import type { LeadCallRow } from '@/lib/leadCalls';

const OUTCOMES: { key: string; label: string; emoji: string; tone?: 'warn' | 'good' }[] = [
  { key: 'NO_ANSWER', label: 'No answer', emoji: '📵', tone: 'warn' },
  { key: 'LEFT_MESSAGE', label: 'Left message', emoji: '💬' },
  { key: 'SPOKE', label: 'Spoke', emoji: '🗣️' },
  { key: 'BOOKED', label: 'Booked', emoji: '✅', tone: 'good' },
  { key: 'NOT_INTERESTED', label: 'Not interested', emoji: '🚫' },
];
const LABELS: Record<string, string> = Object.fromEntries(OUTCOMES.map((o) => [o.key, o.label]));
LABELS.NOTE = 'Note';

const TONE: Record<string, { pill: string; dot: string; chip: string }> = {
  grey: { pill: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400', chip: 'bg-gray-100 text-gray-600' },
  amber: { pill: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500', chip: 'bg-amber-100 text-amber-800' },
  red: { pill: 'bg-red-100 text-red-700', dot: 'bg-red-500', chip: 'bg-red-100 text-red-700' },
  teal: { pill: 'bg-teal-100 text-teal-800', dot: 'bg-teal-500', chip: 'bg-teal-100 text-teal-800' },
  green: { pill: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-500', chip: 'bg-emerald-100 text-emerald-800' },
};

function derive(calls: { outcome: string }[]): { tone: keyof typeof TONE; label: string; next: string | null } {
  if (calls.length === 0) return { tone: 'grey', label: 'Not called yet', next: 'Call now' };
  const noAns = calls.filter((c) => c.outcome === 'NO_ANSWER').length;
  const last = calls[calls.length - 1].outcome;
  switch (last) {
    case 'BOOKED': return { tone: 'green', label: 'Booked ✓', next: null };
    case 'NOT_INTERESTED': return { tone: 'grey', label: 'Not interested', next: null };
    case 'SPOKE': return { tone: 'teal', label: 'Spoke', next: 'Follow up / book' };
    case 'LEFT_MESSAGE': return { tone: 'amber', label: 'Left message', next: 'Follow up' };
    case 'NO_ANSWER':
      return noAns >= 2
        ? { tone: 'red', label: `${noAns} attempts · no answer`, next: 'Call another time' }
        : { tone: 'amber', label: '1 attempt · no answer', next: 'Try again' };
    default: return { tone: 'grey', label: 'Note logged', next: 'Follow up' };
  }
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function LeadCallTracker({ leadKey, initial }: { leadKey: string; initial: LeadCallRow[] }) {
  const [calls, setCalls] = useState<LeadCallRow[]>(initial);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  const s = derive(calls);

  function log(outcome: string) {
    const n = note.trim();
    if (outcome === 'NOTE' && !n) return;
    setError(null);
    const optimistic: LeadCallRow = {
      id: `tmp-${Date.now()}`,
      outcome,
      note: n || null,
      actorName: 'You',
      createdAt: new Date().toISOString(),
    };
    setCalls((c) => [...c, optimistic]);
    setNote('');
    start(async () => {
      const res = await logLeadCallAction({ leadKey, outcome, note: n });
      if (res?.error) {
        setCalls((c) => c.filter((x) => x.id !== optimistic.id));
        setError(res.error);
      }
    });
  }

  function remove(id: string) {
    setCalls((c) => c.filter((x) => x.id !== id));
    if (id.startsWith('tmp-')) return;
    start(async () => {
      const res = await deleteLeadCallAction(id);
      if (res?.error) setError(res.error);
    });
  }

  const t = TONE[s.tone];

  return (
    <div className="mt-3 border-t border-dashed border-gray-200 pt-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${t.pill}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} /> {s.label}
        </span>
        {s.next && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">Next: {s.next}</span>}
        <span className="ml-auto text-xs text-gray-400">{calls.length > 0 ? `${calls.length} logged` : ''}</span>
      </div>

      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Log a call</div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {OUTCOMES.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => log(o.key)}
            className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition ${
              o.tone === 'good'
                ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                : o.tone === 'warn'
                  ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
                  : 'border-gray-200 text-gray-700 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700'
            }`}
          >
            {o.emoji} {o.label}
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); log('NOTE'); } }}
          placeholder="Optional note (e.g. call back after 5pm)"
          className="input flex-1 py-1.5 text-sm"
        />
        <button type="button" onClick={() => log('NOTE')} className="btn-secondary text-xs">Add note</button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      {calls.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {[...calls].reverse().map((c) => (
            <li key={c.id} className="flex items-start gap-2 text-xs text-gray-600">
              <span className="mt-0.5 text-gray-300">•</span>
              <span className="min-w-0 flex-1">
                <span className="font-semibold text-gray-800">{LABELS[c.outcome] ?? c.outcome}</span>
                <span className="text-gray-400"> · {fmt(c.createdAt)}</span>
                {c.actorName && <span className="text-gray-500"> · {c.actorName}</span>}
                {c.note && <span className="block text-gray-500">“{c.note}”</span>}
              </span>
              <button type="button" onClick={() => remove(c.id)} className="shrink-0 text-gray-300 hover:text-red-500" title="Remove">✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
