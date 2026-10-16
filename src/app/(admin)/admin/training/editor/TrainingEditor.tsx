'use client';

import { useState, useTransition } from 'react';
import type { QuizQuestion, Rule } from '@/lib/training';
import { saveTrainingContentAction, resetTrainingContentAction } from './actions';

// Local editable shapes (ids are assigned/kept server-side on save).
interface EditQ { id: string; q: string; options: string[]; correct: number }
interface EditR { id: string; text: string }

function cloneQuiz(q: QuizQuestion[]): EditQ[] {
  return q.map((x) => ({ id: x.id, q: x.q, options: [...x.options], correct: x.correct }));
}

export function TrainingEditor({ initialQuiz, initialRules, isCustom }: { initialQuiz: QuizQuestion[]; initialRules: Rule[]; isCustom: boolean }) {
  const [quiz, setQuiz] = useState<EditQ[]>(cloneQuiz(initialQuiz));
  const [rules, setRules] = useState<EditR[]>(initialRules.map((r) => ({ id: r.id, text: r.text })));
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function updateQ(i: number, patch: Partial<EditQ>) {
    setQuiz((cur) => cur.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  }
  function updateOption(qi: number, oi: number, value: string) {
    setQuiz((cur) => cur.map((q, idx) => (idx === qi ? { ...q, options: q.options.map((o, j) => (j === oi ? value : o)) } : q)));
  }
  function addOption(qi: number) {
    setQuiz((cur) => cur.map((q, idx) => (idx === qi && q.options.length < 6 ? { ...q, options: [...q.options, ''] } : q)));
  }
  function removeOption(qi: number, oi: number) {
    setQuiz((cur) => cur.map((q, idx) => {
      if (idx !== qi || q.options.length <= 2) return q;
      const options = q.options.filter((_, j) => j !== oi);
      let correct = q.correct;
      if (oi === correct) correct = 0;
      else if (oi < correct) correct -= 1;
      return { ...q, options, correct };
    }));
  }
  function addQuestion() {
    setQuiz((cur) => [...cur, { id: '', q: '', options: ['', ''], correct: 0 }]);
  }
  function removeQuestion(i: number) {
    setQuiz((cur) => cur.filter((_, idx) => idx !== i));
  }
  function moveQuestion(i: number, dir: -1 | 1) {
    setQuiz((cur) => {
      const j = i + dir;
      if (j < 0 || j >= cur.length) return cur;
      const next = [...cur];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function save() {
    setMsg(null);
    // Client-side sanity so the admin gets immediate feedback; the server
    // re-coerces and is the source of truth.
    const cleanQuiz = quiz
      .map((q) => ({ ...q, q: q.q.trim(), options: q.options.map((o) => o.trim()).filter(Boolean) }))
      .filter((q) => q.q && q.options.length >= 2);
    const cleanRules = rules.map((r) => ({ ...r, text: r.text.trim() })).filter((r) => r.text);
    if (cleanQuiz.length === 0) { setMsg({ ok: false, text: 'Add at least one question with a prompt and 2+ options.' }); return; }
    if (cleanRules.length === 0) { setMsg({ ok: false, text: 'Add at least one rule.' }); return; }
    start(async () => {
      const res = await saveTrainingContentAction(cleanQuiz, cleanRules);
      setMsg(res.ok ? { ok: true, text: 'Saved. The training link now uses these questions and rules.' } : { ok: false, text: res.error || 'Could not save.' });
    });
  }

  function resetDefaults() {
    setMsg(null);
    start(async () => {
      const res = await resetTrainingContentAction();
      if (res.ok) window.location.reload();
      else setMsg({ ok: false, text: res.error || 'Could not reset.' });
    });
  }

  return (
    <div className="space-y-6">
      {msg && (
        <div className={`rounded-lg border-l-4 p-3 text-sm ${msg.ok ? 'border-green-500 bg-green-50 text-green-800' : 'border-red-500 bg-red-50 text-red-800'}`}>{msg.text}</div>
      )}

      {/* QUIZ */}
      <section className="card p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Quiz questions</h2>
          <span className="text-xs text-gray-500">{quiz.length} question{quiz.length === 1 ? '' : 's'}</span>
        </div>
        <div className="space-y-5">
          {quiz.map((q, qi) => (
            <div key={qi} className="rounded-xl border border-gray-200 p-4">
              <div className="mb-2 flex items-start gap-2">
                <span className="mt-2 text-xs font-semibold text-gray-400">{qi + 1}.</span>
                <textarea value={q.q} onChange={(e) => updateQ(qi, { q: e.target.value })} rows={2}
                  placeholder="Question text" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                <div className="flex flex-col gap-1">
                  <button type="button" onClick={() => moveQuestion(qi, -1)} className="rounded px-1 text-xs text-gray-400 hover:text-gray-700" title="Move up">▲</button>
                  <button type="button" onClick={() => moveQuestion(qi, 1)} className="rounded px-1 text-xs text-gray-400 hover:text-gray-700" title="Move down">▼</button>
                </div>
              </div>
              <div className="space-y-1.5 pl-5">
                {q.options.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <input type="radio" name={`correct-${qi}`} checked={q.correct === oi} onChange={() => updateQ(qi, { correct: oi })} title="Mark as the correct answer" className="h-4 w-4 flex-none" />
                    <input value={opt} onChange={(e) => updateOption(qi, oi, e.target.value)} placeholder={`Option ${oi + 1}`} className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
                    {q.options.length > 2 && (
                      <button type="button" onClick={() => removeOption(qi, oi)} className="flex-none rounded px-2 text-sm text-gray-400 hover:text-red-600" title="Remove option">×</button>
                    )}
                  </div>
                ))}
                <div className="flex items-center gap-3 pt-1">
                  {q.options.length < 6 && <button type="button" onClick={() => addOption(qi)} className="text-xs font-medium text-brand-600 hover:underline">+ Add option</button>}
                  <span className="text-[11px] text-gray-400">The filled radio is the correct answer.</span>
                  <button type="button" onClick={() => removeQuestion(qi)} className="ml-auto text-xs font-medium text-red-500 hover:underline">Delete question</button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={addQuestion} className="mt-4 rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">+ Add question</button>
      </section>

      {/* RULES */}
      <section className="card p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Sign-off rules</h2>
          <span className="text-xs text-gray-500">{rules.length} rule{rules.length === 1 ? '' : 's'}</span>
        </div>
        <div className="space-y-2">
          {rules.map((r, ri) => (
            <div key={ri} className="flex items-start gap-2">
              <span className="mt-2 text-xs font-semibold text-gray-400">{ri + 1}.</span>
              <textarea value={r.text} onChange={(e) => setRules((cur) => cur.map((x, idx) => (idx === ri ? { ...x, text: e.target.value } : x)))} rows={2}
                placeholder="Rule the trainee acknowledges" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <button type="button" onClick={() => setRules((cur) => cur.filter((_, idx) => idx !== ri))} className="mt-1.5 flex-none rounded px-2 text-sm text-gray-400 hover:text-red-600" title="Remove rule">×</button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setRules((cur) => [...cur, { id: '', text: '' }])} className="mt-4 rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">+ Add rule</button>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={pending} onClick={save} className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">{pending ? 'Saving…' : 'Save changes'}</button>
        {isCustom && (
          <button type="button" disabled={pending} onClick={resetDefaults} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">Reset to built-in program</button>
        )}
      </div>
    </div>
  );
}
