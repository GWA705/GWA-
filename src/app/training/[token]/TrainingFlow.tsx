'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  PASS_THRESHOLD, CONTENT_VERSION, scoreQuiz, STRINGS, LANGS,
  type Block, type SubmitResult, type Lang, type Section, type QuizQuestion, type Rule,
} from '@/lib/training';
import { submitTrainingAction } from './actions';
import { SectionIcon, CheckBadge, CheckMark, AlertIcon } from './icons';

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

// Official co-branded lockup (GWA + Home Depot Home Services "Authorized
// Installer"). Reuses the approved partner asset already used on portal emails.
function LogoBar() {
  return (
    <div className="flex items-center justify-center rounded-2xl bg-white px-5 py-4 shadow-sm ring-1 ring-slate-200">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/gwa-hd-partners.png" alt="Georgian Water & Air — Authorized Home Depot Home Services installer" className="h-16 w-auto max-w-full object-contain" />
    </div>
  );
}

// A gradient medallion that holds a section/phase icon — the core "premium" motif.
function IconBadge({ name, className = 'h-14 w-14', icon = 'h-7 w-7' }: { name: string; className?: string; icon?: string }) {
  return (
    <span className={`flex ${className} flex-none items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-900 text-white shadow-lg shadow-brand-600/25 ring-1 ring-white/20`}>
      <SectionIcon name={name} className={icon} />
    </span>
  );
}

function RenderBlock({ b }: { b: Block }) {
  if (b.type === 'p') return <p className="text-[15px] leading-relaxed text-slate-600">{b.text}</p>;
  if (b.type === 'ul') return (
    <ul className="space-y-2">
      {b.items.map((it, i) => (
        <li key={i} className="flex items-start gap-3 rounded-xl bg-slate-50/80 px-3.5 py-2.5 text-[15px] leading-relaxed text-slate-700 ring-1 ring-slate-100">
          <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-brand-50 text-brand-600"><CheckMark className="h-3.5 w-3.5" /></span>
          <span className="min-w-0">{it}</span>
        </li>
      ))}
    </ul>
  );
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50/60 p-4">
      <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-lg bg-amber-100 text-amber-600"><AlertIcon className="h-4 w-4" /></span>
      <p className="text-[15px] font-medium leading-relaxed text-amber-900">{b.text}</p>
    </div>
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
  const answeredCount = QUIZ.filter((q) => typeof answers[q.id] === 'number').length;
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

  // ---- Progress ----
  const order: Phase[] = ['intake', 'learn', 'quiz', 'signoff', 'done'];
  const curIdx = order.indexOf(phase);
  const pct = phase === 'done' ? 100
    : phase === 'learn' ? Math.round(((1 + (learnIdx + 1) / (SECTIONS.length + 1)) / 4) * 100)
    : Math.round((curIdx / 4) * 100);
  const steps = [t.steps.info, t.steps.learn, t.steps.quiz, t.steps.signoff];

  // ---- Branded hero (top of every phase) ----
  const hero = (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-600 to-brand-900 px-6 py-7 text-white shadow-xl shadow-brand-900/20">
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-brand-500/30 blur-2xl" />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">{t.title}</h1>
            <div className="mt-1 text-xs text-white/70">{t.brandSub}</div>
          </div>
          {available.length > 1 && (
            <div className="flex flex-none gap-1 rounded-full bg-white/10 p-1 ring-1 ring-white/20">
              {available.map((l) => (
                <button key={l} type="button" onClick={() => setLang(l)}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${l === lang ? 'bg-white text-brand-700' : 'text-white/80 hover:text-white'}`}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium ring-1 ring-white/15">
          <span className="text-white/60">{t.office}</span> <span>{dealerName}</span>
        </div>

        {phase !== 'done' && (
          <div className="mt-5">
            <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-white/70">
              <span>{steps[Math.min(curIdx, 3)]}</span>
              <span className="tabular-nums">{pct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-white transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-2 flex gap-1.5">
              {steps.map((label, i) => {
                const done = i < curIdx;
                const active = i === curIdx || (phase === 'learn' && i === 1);
                return (
                  <div key={label} className="flex flex-1 items-center gap-1.5">
                    <span className={`flex h-5 w-5 flex-none items-center justify-center rounded-full text-[10px] font-bold ring-1 ${done ? 'bg-white text-brand-700 ring-white' : active ? 'bg-white/20 text-white ring-white/40' : 'bg-transparent text-white/50 ring-white/20'}`}>
                      {done ? '✓' : i + 1}
                    </span>
                    <span className={`hidden truncate text-[11px] sm:inline ${active ? 'text-white' : 'text-white/55'}`}>{label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // ---- DONE (certificate) ----
  if (phase === 'done' && result?.ok) {
    return (
      <div className="mx-auto max-w-2xl space-y-5 px-4 py-10">
        <LogoBar />
        <div className="overflow-hidden rounded-3xl bg-white shadow-xl shadow-slate-300/40 ring-1 ring-slate-200 print:shadow-none">
          <div className="relative bg-gradient-to-br from-brand-700 via-brand-600 to-brand-900 px-8 py-10 text-center text-white">
            <div aria-hidden className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, white 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
            <div className="relative">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/15 ring-4 ring-white/20">
                <SectionIcon name="trophy" className="h-11 w-11" />
              </div>
              <h2 className="mt-4 text-2xl font-bold">{t.doneTitle}</h2>
              <p className="mt-1 text-sm text-white/80">{tpl(t.doneSub, { first: name.trim().split(' ')[0] })}</p>
            </div>
          </div>

          <div className="px-8 py-7">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{t.certTitle}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700"><CheckBadge className="h-3.5 w-3.5" /> {tpl(t.score, { s: result.score ?? 0 })}</span>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
              <div><dt className="text-xs text-slate-400">{t.fullName}</dt><dd className="font-semibold text-slate-900">{name.trim()}</dd></div>
              <div><dt className="text-xs text-slate-400">{t.dealerLabel}</dt><dd className="font-semibold text-slate-900">{dealerName}</dd></div>
              <div><dt className="text-xs text-slate-400">{t.dateLabel}</dt><dd className="font-semibold text-slate-900">{new Date().toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA')}</dd></div>
              <div><dt className="text-xs text-slate-400">{t.versionLabel}</dt><dd className="font-semibold text-slate-900">{CONTENT_VERSION}</dd></div>
            </dl>
            <p className="mt-5 rounded-xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-500 ring-1 ring-slate-100">
              {tpl(t.signedBy, { sig: signature.trim(), n: RULES.length })}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2 print:hidden">
              <button onClick={() => window.print()} className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 hover:bg-brand-700">{t.print}</button>
            </div>
            <p className="mt-3 text-center text-xs text-slate-400 print:hidden">{t.doneFoot}</p>
          </div>
        </div>
      </div>
    );
  }

  const card = 'rounded-3xl bg-white p-6 shadow-lg shadow-slate-300/30 ring-1 ring-slate-200 sm:p-7';

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-8">
      <LogoBar />
      {hero}

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-800">
          <AlertIcon className="mt-0.5 h-4 w-4 flex-none text-red-500" /> <span>{error}</span>
        </div>
      )}

      {/* ---- INTAKE ---- */}
      {phase === 'intake' && (
        <div className={card}>
          <div className="mb-5 flex items-start gap-4">
            <IconBadge name="expectations" />
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-900">{t.intakeTitle}</h2>
              <p className="mt-0.5 text-sm text-slate-500">{t.intakeSub}</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">{t.fullName}</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" placeholder={t.phName} /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">{t.phone}</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" placeholder={t.phPhone} inputMode="tel" /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">{t.email}</span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" placeholder={t.phEmail} inputMode="email" /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">{t.address}</span>
              <input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" placeholder={t.phAddress} /></label>
          </div>
          <button onClick={startIntake} className="mt-6 w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-700">{t.start}</button>
          <p className="mt-2.5 text-center text-[11px] text-slate-400">{t.intakeConsent}</p>
        </div>
      )}

      {/* ---- LEARN ---- */}
      {phase === 'learn' && (() => {
        const s = SECTIONS[learnIdx];
        return (
          <div className={card}>
            <div className="mb-4 flex items-center gap-4">
              <IconBadge name={s.id} />
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-600">{tpl(t.sectionOf, { i: learnIdx + 1, n: SECTIONS.length })}</div>
                <h2 className="mt-0.5 text-xl font-bold text-slate-900">{s.title}</h2>
              </div>
            </div>
            {/* chapter dots */}
            <div className="mb-5 flex flex-wrap gap-1.5">
              {SECTIONS.map((_, i) => (
                <span key={i} className={`h-1.5 rounded-full transition-all ${i === learnIdx ? 'w-6 bg-brand-600' : i < learnIdx ? 'w-1.5 bg-brand-100' : 'w-1.5 bg-slate-200'}`} />
              ))}
            </div>
            <div className="space-y-3">{s.blocks.map((b, i) => <RenderBlock key={i} b={b} />)}</div>
            <div className="mt-7 flex items-center justify-between border-t border-slate-100 pt-5">
              <button onClick={() => { if (learnIdx === 0) setPhase('intake'); else setLearnIdx(learnIdx - 1); window.scrollTo({ top: 0 }); }}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-800">{t.back}</button>
              {learnIdx < SECTIONS.length - 1 ? (
                <button onClick={() => { setLearnIdx(learnIdx + 1); window.scrollTo({ top: 0 }); }} className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 hover:bg-brand-700">{t.next}</button>
              ) : (
                <button onClick={() => { setPhase('quiz'); window.scrollTo({ top: 0 }); }} className="rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-green-600/25 hover:bg-green-700">{t.startQuiz}</button>
              )}
            </div>
          </div>
        );
      })()}

      {/* ---- QUIZ ---- */}
      {phase === 'quiz' && (
        <div className={card}>
          <div className="mb-5 flex items-center gap-4">
            <IconBadge name="quiz" />
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-900">{t.quizTitle}</h2>
              <p className="mt-0.5 text-sm text-slate-500">{tpl(t.quizSub, { n: QUIZ.length, p: PASS_THRESHOLD })}</p>
            </div>
            <span className="ml-auto flex-none rounded-full bg-brand-50 px-3 py-1 text-xs font-bold tabular-nums text-brand-700">{answeredCount}/{QUIZ.length}</span>
          </div>
          <div className="space-y-5">
            {QUIZ.map((q, qi) => (
              <div key={q.id} className="rounded-2xl bg-slate-50/70 p-4 ring-1 ring-slate-100">
                <p className="mb-3 flex gap-2 text-sm font-semibold text-slate-900">
                  <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white">{qi + 1}</span>
                  <span className="min-w-0">{q.q}</span>
                </p>
                <div className="grid gap-2">
                  {q.options.map((opt, oi) => {
                    const sel = answers[q.id] === oi;
                    return (
                      <button key={oi} type="button" onClick={() => setAnswers({ ...answers, [q.id]: oi })}
                        className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-sm transition ${sel ? 'border-brand-500 bg-white font-medium text-brand-700 ring-2 ring-brand-100' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'}`}>
                        <span className={`flex h-4 w-4 flex-none items-center justify-center rounded-full border ${sel ? 'border-brand-600 bg-brand-600' : 'border-slate-300'}`}>{sel && <span className="h-1.5 w-1.5 rounded-full bg-white" />}</span>
                        <span className="min-w-0">{opt}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-5">
            <button onClick={() => { setPhase('learn'); setLearnIdx(SECTIONS.length - 1); window.scrollTo({ top: 0 }); }} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-800">{t.review}</button>
            <button disabled={!allAnswered} onClick={() => { setError(null); setPhase('signoff'); window.scrollTo({ top: 0 }); }}
              className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none">
              {allAnswered ? (liveScore.passed ? tpl(t.continueScored, { s: liveScore.score }) : t.continuePlain) : tpl(t.answerAll, { n: QUIZ.length })}
            </button>
          </div>
          {allAnswered && !liveScore.passed && <p className="mt-2 text-right text-xs font-medium text-amber-700">{tpl(t.quizBelow, { s: liveScore.score })}</p>}
        </div>
      )}

      {/* ---- SIGN-OFF ---- */}
      {phase === 'signoff' && (
        <div className={card}>
          <div className="mb-5 flex items-center gap-4">
            <IconBadge name="signoff" />
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-900">{t.signoffTitle}</h2>
              <p className="mt-0.5 text-sm text-slate-500">{t.signoffSub}</p>
            </div>
          </div>
          <div className="space-y-2">
            {RULES.map((r) => {
              const on = acked.has(r.id);
              return (
                <label key={r.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 text-sm transition ${on ? 'border-green-300 bg-green-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
                  <span className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-md border transition ${on ? 'border-green-600 bg-green-600 text-white' : 'border-slate-300 bg-white'}`}>{on && <CheckMark className="h-3.5 w-3.5" />}</span>
                  <input type="checkbox" checked={on} onChange={() => { const n = new Set(acked); if (on) n.delete(r.id); else n.add(r.id); setAcked(n); }} className="sr-only" />
                  <span className={on ? 'text-green-900' : 'text-slate-700'}>{r.text}</span>
                </label>
              );
            })}
          </div>
          <div className="mt-5 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4">
            <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">{t.signLabel}</span>
              <input value={signature} onChange={(e) => setSignature(e.target.value)} placeholder={t.phSign} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 font-[cursive] text-xl text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" /></label>
            <p className="mt-2 text-[11px] text-slate-500">{t.signConsent}</p>
          </div>
          <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-5">
            <button onClick={() => { setPhase('quiz'); window.scrollTo({ top: 0 }); }} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-800">{t.back}</button>
            <button disabled={pending || !allAcked || signature.trim().length < 2} onClick={submit}
              className="inline-flex items-center gap-1.5 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-green-600/25 hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none">
              <CheckBadge className="h-4 w-4" /> {pending ? t.submitting : t.submit}
            </button>
          </div>
          {!allAcked && <p className="mt-2 text-right text-xs text-slate-400">{tpl(t.tickAll, { n: RULES.length })}</p>}
        </div>
      )}
    </div>
  );
}
