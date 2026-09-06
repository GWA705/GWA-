'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { logLeadCallAction, deleteLeadCallAction } from '@/lib/leadCallActions';
import type { LeadCallRow } from '@/lib/leadCalls';
import { useT } from '@/i18n/client';
import type { TFunction } from '@/i18n/translator';

// `short` is the compact button face; `label` is the full wording used in the
// status pill and the logged-call history. Text is resolved from the dictionary
// at render (see buildOutcomes); only key/emoji/color are static here.
const OUTCOME_META: { key: string; shortKey: string; labelKey: string; emoji: string; color: string }[] = [
  { key: 'NO_ANSWER', shortKey: 'ocNoAnswerShort', labelKey: 'ocNoAnswer', emoji: '📵', color: 'bg-amber-500 hover:bg-amber-600' },
  { key: 'LEFT_MESSAGE', shortKey: 'ocLeftMessageShort', labelKey: 'ocLeftMessage', emoji: '💬', color: 'bg-sky-500 hover:bg-sky-600' },
  { key: 'SPOKE', shortKey: 'ocSpokeShort', labelKey: 'ocSpoke', emoji: '🗣️', color: 'bg-indigo-500 hover:bg-indigo-600' },
  { key: 'BOOKED', shortKey: 'ocBookedShort', labelKey: 'ocBooked', emoji: '✅', color: 'bg-emerald-600 hover:bg-emerald-700' },
  { key: 'SOLD', shortKey: 'ocSoldShort', labelKey: 'ocSold', emoji: '💰', color: 'bg-violet-600 hover:bg-violet-700' },
  { key: 'NOT_INTERESTED', shortKey: 'ocNotInterestedShort', labelKey: 'ocNotInterested', emoji: '🚫', color: 'bg-rose-500 hover:bg-rose-600' },
];

const TONE: Record<string, { pill: string; dot: string; chip: string }> = {
  grey: { pill: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400', chip: 'bg-gray-100 text-gray-600' },
  amber: { pill: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500', chip: 'bg-amber-100 text-amber-800' },
  red: { pill: 'bg-red-100 text-red-700', dot: 'bg-red-500', chip: 'bg-red-100 text-red-700' },
  teal: { pill: 'bg-teal-100 text-teal-800', dot: 'bg-teal-500', chip: 'bg-teal-100 text-teal-800' },
  green: { pill: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-500', chip: 'bg-emerald-100 text-emerald-800' },
  violet: { pill: 'bg-violet-100 text-violet-800', dot: 'bg-violet-500', chip: 'bg-violet-100 text-violet-800' },
};

function derive(calls: { outcome: string }[], t: TFunction): { tone: keyof typeof TONE; label: string; next: string | null } {
  if (calls.length === 0) return { tone: 'grey', label: t('leads.dNotCalled'), next: t('leads.nextCallNow') };
  const noAns = calls.filter((c) => c.outcome === 'NO_ANSWER').length;
  const last = calls[calls.length - 1].outcome;
  switch (last) {
    case 'SOLD': return { tone: 'violet', label: t('leads.dSold'), next: null };
    case 'BOOKED': return { tone: 'green', label: t('leads.dBooked'), next: null };
    case 'NOT_INTERESTED': return { tone: 'grey', label: t('leads.dNotInterested'), next: null };
    case 'SPOKE': return { tone: 'teal', label: t('leads.dSpoke'), next: t('leads.nextFollowUpBook') };
    case 'LEFT_MESSAGE': return { tone: 'amber', label: t('leads.dLeftMessage'), next: t('leads.nextFollowUp') };
    case 'NO_ANSWER':
      return noAns >= 2
        ? { tone: 'red', label: t('leads.dNoAnswerN', { n: noAns }), next: t('leads.nextCallAnother') }
        : { tone: 'amber', label: t('leads.dNoAnswer1'), next: t('leads.nextTryAgain') };
    default: return { tone: 'grey', label: t('leads.dNoteLogged'), next: t('leads.nextFollowUp') };
  }
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function LeadCallTracker({ leadKey, initial }: { leadKey: string; initial: LeadCallRow[] }) {
  const tr = useT();
  const OUTCOMES = OUTCOME_META.map((o) => ({ ...o, short: tr(`leads.${o.shortKey}`), label: tr(`leads.${o.labelKey}`) }));
  const outcomeLabel = (key: string): string => {
    if (key === 'NOTE') return tr('leads.ocNote');
    const m = OUTCOME_META.find((o) => o.key === key);
    return m ? tr(`leads.${m.labelKey}`) : key;
  };
  const [calls, setCalls] = useState<LeadCallRow[]>(initial);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const router = useRouter();

  const s = derive(calls, tr);

  function log(outcome: string) {
    const n = note.trim();
    if (outcome === 'NOTE' && !n) return;
    setError(null);
    const optimistic: LeadCallRow = {
      id: `tmp-${Date.now()}`,
      outcome,
      note: n || null,
      actorName: tr('leads.you'),
      createdAt: new Date().toISOString(),
    };
    setCalls((c) => [...c, optimistic]);
    setNote('');
    start(async () => {
      const res = await logLeadCallAction({ leadKey, outcome, note: n });
      if (res?.error) {
        setCalls((c) => c.filter((x) => x.id !== optimistic.id));
        setError(res.error);
      } else {
        // Keep the collapsed-card status pill (rendered on the server) in step
        // with what was just logged.
        router.refresh();
      }
    });
  }

  function remove(id: string) {
    setCalls((c) => c.filter((x) => x.id !== id));
    if (id.startsWith('tmp-')) return;
    start(async () => {
      const res = await deleteLeadCallAction(id);
      if (res?.error) setError(res.error);
      else router.refresh(); // refresh the server-rendered status pill after removal
    });
  }

  const t = TONE[s.tone];

  return (
    <div className="mt-3 border-t border-dashed border-gray-200 pt-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${t.pill}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} /> {s.label}
        </span>
        {s.next && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">{tr('leads.nextTitle', { next: s.next })}</span>}
        <span className="ml-auto text-xs text-gray-400">{calls.length > 0 ? tr('leads.loggedCount', { n: calls.length }) : ''}</span>
      </div>

      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{tr('leads.logACall')}</div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {OUTCOMES.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => log(o.key)}
            title={o.label}
            aria-label={tr('leads.logAria', { label: o.label })}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition active:scale-95 ${o.color}`}
          >
            <span aria-hidden>{o.emoji}</span> {o.short}
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); log('NOTE'); } }}
          placeholder={tr('leads.notePlaceholder')}
          className="input flex-1 py-1.5 text-sm"
        />
        <button type="button" onClick={() => log('NOTE')} className="rounded-lg bg-slate-700 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 active:scale-95">{tr('leads.addNote')}</button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      {calls.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {[...calls].reverse().map((c) => (
            <li key={c.id} className="flex items-start gap-2 text-xs text-gray-600">
              <span className="mt-0.5 text-gray-300">•</span>
              <span className="min-w-0 flex-1">
                <span className="font-semibold text-gray-800">{outcomeLabel(c.outcome)}</span>
                <span className="text-gray-400"> · {fmt(c.createdAt)}</span>
                {c.actorName && <span className="text-gray-500"> · {c.actorName}</span>}
                {c.note && <span className="block text-gray-500">“{c.note}”</span>}
              </span>
              <button type="button" onClick={() => remove(c.id)} className="shrink-0 text-gray-300 hover:text-red-500" title={tr('leads.removeCall')}>✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
