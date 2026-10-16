'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  PASS_THRESHOLD, CONTENT_VERSION, scoreQuiz, STRINGS, LANGS,
  type Block, type SubmitResult, type Lang, type Section, type QuizQuestion, type Rule,
} from '@/lib/training';
import { submitTrainingAction } from './actions';
import { SectionIcon, CheckBadge } from './icons';

type Phase = 'intake' | 'learn' | 'quiz' | 'signoff' | 'done';

export interface TrainingBundle {
  lang: Lang;
  sections: Section[];
  quiz: QuizQuestion[];
  rules: Rule[];
}

// Fill {placeholders} in a localized string.
function tpl(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

function Progress({ phase, learnIdx, sectionCount, labels }: { phase: Phase; learnIdx: number; sectionCount: number; labels: { info: string; learn: string; quiz: string; signoff: string } }) {
  const steps = [
    { key: 'intake', label: labels.info },
    { key: 'learn', label: labels.learn },
    { key: 'quiz', label: labels.quiz },
    { key: 'signoff', label: labels.signoff },
  ];
  const order: Phase[] = ['intake', 'learn', 'quiz', 'signoff', 'done'];
  const curIdx = order.indexOf(phase);
  const pct = phase === 'done' ? 100
    : phase === 'learn' ? Math.round(((1 + (learnIdx + 1) / (sectionCount + 1)) / 4) * 100)
    : Math.round((curIdx / 4) * 100);
  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center justify-between">
        {steps.map((s, i) => {
          const done = order.indexOf(s.key as Phase) < curIdx || phase === 'done';
          const active = s.key === phase;
          return (
            <div key={s.key} className="flex flex-1 items-center">
              <div className={`flex h-7 w-7 flex-none items-center justify-center rounded-full text-xs font-bold ${done ? 'bg-green-500 text-white' : active ? 'bg-brand-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                {done ? '✓' : i + 1}
              </div>
              <span className={`ml-1.5 hidden text-xs font-medium sm:inline ${active ? 'text-brand-700' : 'text-gray-500'}`}>{s.label}</span>
              {i < steps.length - 1 && <div className={`mx-1.5 h-0.5 flex-1 rounded ${done ? 'bg-green-400' : 'bg-gray-200'}`} />}
            </div>
          );
        })}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-gray-200">
        <div className="h-full rounded-full bg-brand-500 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function RenderBlock({ b }: { b: Block }) {
  if (b.type === 'p') return <p className="text-[15px] leading-relaxed text-gray-700">{b.text}</p>;
  if (b.type === 'ul') return (
    <ul className="space-y-1.5">
      {b.items.map((it, i) => (
        <li key={i} className="flex gap-2 text-[15px] leading-relaxed text-gray-700">
          <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-brand-400" /> <span>{it}</span>
        </li>
      ))}
    </ul>
  );
  return (
    <div className="rounded-lg border-l-4 border-amber-400 bg-amber-50 p-3 text-[15px] font-medium leading-relaxed text-amber-900">{b.text}</div>
  );
}

export function TrainingFlow({ token, dealerName, bundles }: { token: string; dealerName: string; bundles: TrainingBundle[] }) {
  const byLang = useMemo(() => {
    const m = {} as Record<Lang, TrainingBundle>;
    for (const b of bundles) m[b.lang] = b;
    return m;
  }, [bundles]);
  const available = LANGS.filter((l) => byLang[l]);
  const [lang, setLang] = useState<Lang>(available[0] || 'en');
  const bundle = byLang[lang] || bundles[0];
  const { sections: SECTIONS, quiz: QUIZ, rules: RULES } = bundle;
  const t = STRINGS[lang];

  const [phase, setPhase] = useState<Phase>('intake');
  const [learnIdx, setLearnIdx] = useState(0);

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [acked, setAcked] = useState<Set<string>>(new Set());
  const [signature, setSignature] = useState('');

  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);

  const allAnswered = useMemo(() => QUIZ.every((q) => typeof answers[q.id] === 'number'), [QUIZ, answers]);
  const allAcked = RULES.every((r) => acked.has(r.id));
  const liveScore = useMemo(() => scoreQuiz(answers, QUIZ), [answers, QUIZ]);

  function startIntake() {
    setError(null);
    if (name.trim().length < 2) return setError(t.errName);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError(t.errEmail);
    if (phone.replace(/\D/g, '').length < 10) return setError(t.errPhone);
    setPhase('learn'); setLearnIdx(0); window.scrollTo({ top: 0 });
  }

  function submit() {
    setError(null);
    start(async () => {
      const res = await submitTrainingAction(token, {
        traineeName: name, traineeEmail: email, traineePhone: phone, traineeAddress: address,
        answers, acknowledged: Array.from(acked), signatureName: signature, lang,
      });
      if (!res.ok) { setError(res.error || t.errGeneric); return; }
      setResult(res); setPhase('done'); window.scrollTo({ top: 0 });
    });
  }

  const langToggle = available.length > 1 && (
    <div className="mt-3 flex justify-center gap-1 print:hidden">
      {available.map((l) => (
        <button key={l} type="button" onClick={() => setLang(l)}
          className={`rounded-full px-3 py-1 text-xs font-medium ${l === lang ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          {STRINGS[l].langName}
        </button>
      ))}
    </div>
  );

  const header = (
    <div className="mb-5 text-center">
      <div className="text-sm font-semibold text-gray-900">{t.brandTop}</div>
      <div className="text-xs text-gray-500">{t.brandSub}</div>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-900">{t.title}</h1>
      <div className="mt-1 text-xs text-gray-400">{t.office} <span className="font-medium text-gray-600">{dealerName}</span></div>
      {langToggle}
    </div>
  );

  // ---- DONE ----
  if (phase === 'done' && result?.ok) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="rounded-2xl border border-green-200 bg-white p-8 text-center shadow-sm print:border-gray-300 print:shadow-none">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-green-600">
            <SectionIcon name="trophy" className="h-11 w-11" />
          </div>
          <h2 className="mt-4 text-2xl font-bold text-gray-900">{t.doneTitle}</h2>
          <p className="mt-1 text-sm text-gray-500">{tpl(t.doneSub, { first: name.trim().split(' ')[0] })}</p>

          <div className="mt-6 rounded-xl border border-gray-200 bg-slate-50/70 p-6 text-left">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">{t.certTitle}</span>
              <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-700">{tpl(t.score, { s: result.score ?? 0 })}</span>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-gray-400">{t.fullName}</dt><dd className="font-medium text-gray-900">{name.trim()}</dd></div>
              <div><dt className="text-gray-400">{t.dealerLabel}</dt><dd className="font-medium text-gray-900">{dealerName}</dd></div>
              <div><dt className="text-gray-400">{t.dateLabel}</dt><dd className="font-medium text-gray-900">{new Date().toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA')}</dd></div>
              <div><dt className="text-gray-400">{t.versionLabel}</dt><dd className="font-medium text-gray-900">{CONTENT_VERSION}</dd></div>
            </dl>
            <p className="mt-4 border-t border-gray-200 pt-3 text-xs text-gray-500">
              {tpl(t.signedBy, { sig: signature.trim(), n: RULES.length })}
            </p>
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-2 print:hidden">
            <button onClick={() => window.print()} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">{t.print}</button>
          </div>
          <p className="mt-3 text-xs text-gray-400 print:hidden">{t.doneFoot}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {header}
      {phase !== 'done' && <Progress phase={phase} learnIdx={learnIdx} sectionCount={SECTIONS.length} labels={t.steps} />}

      {error && <div className="mb-4 rounded-lg border-l-4 border-red-500 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      {/* ---- INTAKE ---- */}
      {phase === 'intake' && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-brand-50 text-brand-600"><SectionIcon name="expectations" /></div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{t.intakeTitle}</h2>
              <p className="text-sm text-gray-500">{t.intakeSub}</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="mb-1 block text-xs font-medium text-gray-700">{t.fullName}</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder={t.phName} /></label>
            <label className="block"><span className="mb-1 block text-xs font-medium text-gray-700">{t.phone}</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder={t.phPhone} inputMode="tel" /></label>
            <label className="block"><span className="mb-1 block text-xs font-medium text-gray-700">{t.email}</span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder={t.phEmail} inputMode="email" /></label>
            <label className="block"><span className="mb-1 block text-xs font-medium text-gray-700">{t.address}</span>
              <input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder={t.phAddress} /></label>
          </div>
          <button onClick={startIntake} className="mt-5 w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">{t.start}</button>
          <p className="mt-2 text-center text-[11px] text-gray-400">{t.intakeConsent}</p>
        </div>
      )}

      {/* ---- LEARN ---- */}
      {phase === 'learn' && (() => {
        const s = SECTIONS[learnIdx];
        return (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-1 text-xs font-medium text-gray-400">{tpl(t.sectionOf, { i: learnIdx + 1, n: SECTIONS.length })}</div>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-brand-50 text-brand-600"><SectionIcon name={s.id} /></div>
              <h2 className="text-xl font-bold text-gray-900">{s.title}</h2>
            </div>
            <div className="space-y-3">{s.blocks.map((b, i) => <RenderBlock key={i} b={b} />)}</div>
            <div className="mt-6 flex items-center justify-between">
              <button onClick={() => { if (learnIdx === 0) setPhase('intake'); else setLearnIdx(learnIdx - 1); window.scrollTo({ top: 0 }); }}
                className="rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-800">{t.back}</button>
              {learnIdx < SECTIONS.length - 1 ? (
                <button onClick={() => { setLearnIdx(learnIdx + 1); window.scrollTo({ top: 0 }); }} className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700">{t.next}</button>
              ) : (
                <button onClick={() => { setPhase('quiz'); window.scrollTo({ top: 0 }); }} className="rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700">{t.startQuiz}</button>
              )}
            </div>
          </div>
        );
      })()}

      {/* ---- QUIZ ---- */}
      {phase === 'quiz' && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-brand-50 text-brand-600"><SectionIcon name="quiz" /></div>
            <div><h2 className="text-lg font-bold text-gray-900">{t.quizTitle}</h2><p className="text-sm text-gray-500">{tpl(t.quizSub, { n: QUIZ.length, p: PASS_THRESHOLD })}</p></div>
          </div>
          <div className="space-y-5">
            {QUIZ.map((q, qi) => (
              <div key={q.id}>
                <p className="mb-2 text-sm font-semibold text-gray-900">{qi + 1}. {q.q}</p>
                <div className="grid gap-2">
                  {q.options.map((opt, oi) => {
                    const sel = answers[q.id] === oi;
                    return (
                      <button key={oi} type="button" onClick={() => setAnswers({ ...answers, [q.id]: oi })}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm ${sel ? 'border-brand-500 bg-brand-50 font-medium text-brand-800' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
                        <span className={`flex h-4 w-4 flex-none items-center justify-center rounded-full border ${sel ? 'border-brand-600 bg-brand-600' : 'border-gray-300'}`}>{sel && <span className="h-1.5 w-1.5 rounded-full bg-white" />}</span>
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex items-center justify-between">
            <button onClick={() => { setPhase('learn'); setLearnIdx(SECTIONS.length - 1); window.scrollTo({ top: 0 }); }} className="rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-800">{t.review}</button>
            <button disabled={!allAnswered} onClick={() => { setError(null); setPhase('signoff'); window.scrollTo({ top: 0 }); }}
              className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40">
              {allAnswered ? (liveScore.passed ? tpl(t.continueScored, { s: liveScore.score }) : t.continuePlain) : tpl(t.answerAll, { n: QUIZ.length })}
            </button>
          </div>
          {allAnswered && !liveScore.passed && <p className="mt-2 text-right text-xs text-amber-700">{tpl(t.quizBelow, { s: liveScore.score })}</p>}
        </div>
      )}

      {/* ---- SIGN-OFF ---- */}
      {phase === 'signoff' && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-brand-50 text-brand-600"><SectionIcon name="signoff" /></div>
            <div><h2 className="text-lg font-bold text-gray-900">{t.signoffTitle}</h2><p className="text-sm text-gray-500">{t.signoffSub}</p></div>
          </div>
          <div className="space-y-2">
            {RULES.map((r) => {
              const on = acked.has(r.id);
              return (
                <label key={r.id} className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-sm ${on ? 'border-green-300 bg-green-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <input type="checkbox" checked={on} onChange={() => { const n = new Set(acked); if (on) n.delete(r.id); else n.add(r.id); setAcked(n); }} className="mt-0.5 h-4 w-4 flex-none" />
                  <span className={on ? 'text-green-900' : 'text-gray-700'}>{r.text}</span>
                </label>
              );
            })}
          </div>
          <div className="mt-5 rounded-lg border border-gray-200 bg-slate-50/70 p-4">
            <label className="block"><span className="mb-1 block text-xs font-medium text-gray-700">{t.signLabel}</span>
              <input value={signature} onChange={(e) => setSignature(e.target.value)} placeholder={t.phSign} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-[cursive] text-lg text-gray-900" /></label>
            <p className="mt-1.5 text-[11px] text-gray-500">{t.signConsent}</p>
          </div>
          <div className="mt-6 flex items-center justify-between">
            <button onClick={() => { setPhase('quiz'); window.scrollTo({ top: 0 }); }} className="rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-800">{t.back}</button>
            <button disabled={pending || !allAcked || signature.trim().length < 2} onClick={submit}
              className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-40">
              <CheckBadge className="h-4 w-4" /> {pending ? t.submitting : t.submit}
            </button>
          </div>
          {!allAcked && <p className="mt-2 text-right text-xs text-gray-400">{tpl(t.tickAll, { n: RULES.length })}</p>}
        </div>
      )}
    </div>
  );
}
