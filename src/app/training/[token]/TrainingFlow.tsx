'use client';

import { useMemo, useState, useTransition, type ReactNode } from 'react';
import {
  PASS_THRESHOLD, CONTENT_VERSION, scoreQuiz, STRINGS, LANGS,
  type Block, type SubmitResult, type Lang, type Section, type QuizQuestion, type Rule, type TrainingStrings,
} from '@/lib/training';
import { submitTrainingAction } from './actions';
import { SectionIcon, CheckBadge, CheckMark, AlertIcon } from './icons';

type Phase = 'intake' | 'learn' | 'quiz' | 'signoff' | 'done';
const ORDER: Phase[] = ['intake', 'learn', 'quiz', 'signoff', 'done'];

export interface TrainingBundle {
  lang: Lang;
  sections: Section[];
  quiz: QuizQuestion[];
  rules: Rule[];
}

function tpl(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '').slice(0, 2);
}

function IconBadge({ name, className = 'h-14 w-14', icon = 'h-7 w-7' }: { name: string; className?: string; icon?: string }) {
  return (
    <span className={`flex ${className} flex-none items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-900 text-white shadow-lg shadow-brand-600/25 ring-1 ring-white/20`}>
      <SectionIcon name={name} className={icon} />
    </span>
  );
}

// Placeholders in the training copy that get swapped for the trainee's first
// name once they've entered it (English + French forms).
const NAME_TOKENS = ['[your name]', '[votre nom]'];
function personalize(text: string, firstName: string): string {
  if (!firstName) return text;
  let out = text;
  for (const tok of NAME_TOKENS) out = out.split(tok).join(firstName);
  return out;
}

function RenderBlock({ b, firstName }: { b: Block; firstName: string }) {
  if (b.type === 'p') return <p className="text-[15px] leading-relaxed text-slate-600">{personalize(b.text, firstName)}</p>;
  if (b.type === 'ul') return (
    <ul className="space-y-2">
      {b.items.map((it, i) => (
        <li key={i} className="flex items-start gap-3 rounded-xl bg-slate-50/80 px-3.5 py-2.5 text-[15px] leading-relaxed text-slate-700 ring-1 ring-slate-100">
          <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-brand-50 text-brand-600"><CheckMark className="h-3.5 w-3.5" /></span>
          <span className="min-w-0">{personalize(it, firstName)}</span>
        </li>
      ))}
    </ul>
  );
  if (b.type === 'img') return (
    <figure className="overflow-hidden rounded-xl ring-1 ring-slate-200">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={b.src} alt={b.alt} className="w-full object-contain" />
      {b.caption && <figcaption className="bg-slate-50 px-3 py-2 text-center text-xs text-slate-500">{b.caption}</figcaption>}
    </figure>
  );
  if (b.type === 'qa') return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start gap-3 border-l-4 border-brand-500 bg-brand-50/50 px-4 py-3">
        <span className="flex h-6 w-6 flex-none items-center justify-center rounded-md bg-brand-600 text-[11px] font-bold text-white">Q</span>
        <p className="text-[15px] font-semibold leading-snug text-slate-900">{personalize(b.q, firstName)}</p>
      </div>
      <div className="flex items-start gap-3 px-4 py-3">
        <span className="flex h-6 w-6 flex-none items-center justify-center rounded-md bg-green-100 text-[11px] font-bold text-green-700">A</span>
        <p className="text-[15px] leading-relaxed text-slate-600">{personalize(b.a, firstName)}</p>
      </div>
    </div>
  );
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50/60 p-4">
      <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-lg bg-amber-100 text-amber-600"><AlertIcon className="h-4 w-4" /></span>
      <p className="text-[15px] font-medium leading-relaxed text-amber-900">{personalize(b.text, firstName)}</p>
    </div>
  );
}

// Branded, co-branded top bar: GWA logo · title · Home Depot logo · progress · you.
function TopBar({ t, pct, initials, lang, setLang, langs, showProgress }: {
  t: TrainingStrings; pct: number; initials: string; lang: Lang;
  setLang: (l: Lang) => void; langs: Lang[]; showProgress: boolean;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
      <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-4 py-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/training/gwa-logo.png" alt="Georgian Water & Air" className="h-9 w-auto flex-none sm:h-10" />
        <span className="hidden h-8 w-px flex-none bg-slate-200 sm:block" />
        <div className="hidden min-w-0 sm:block">
          <div className="truncate text-sm font-bold leading-tight text-slate-900">{t.title}</div>
          <div className="truncate text-[11px] text-slate-500">{t.brandSub}</div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/training/hd-home-services.jpg" alt="The Home Depot Home Services — Authorized Installer" className="hidden h-8 w-auto flex-none md:block" />

        <div className="ml-auto flex items-center gap-3">
          {showProgress && (
            <div className="hidden items-center gap-2 sm:flex">
              <div className="text-right">
                <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Your progress</div>
                <div className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-200 lg:w-40">
                  <div className="h-full rounded-full bg-brand-600 transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
              <span className="text-sm font-bold tabular-nums text-brand-700">{pct}%</span>
            </div>
          )}
          {langs.length > 1 && (
            <div className="flex flex-none gap-0.5 rounded-full bg-slate-100 p-0.5">
              {langs.map((l) => (
                <button key={l} type="button" onClick={() => setLang(l)}
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${l === lang ? 'bg-brand-600 text-white' : 'text-slate-500 hover:text-slate-800'}`}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          )}
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-bold text-white ring-2 ring-white">
            {initials || <SectionIcon name="expectations" className="h-4 w-4" />}
          </span>
        </div>
      </div>
    </header>
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

  const firstName = name.trim().split(/\s+/)[0] || '';
  const curIdx = ORDER.indexOf(phase);
  const pct = phase === 'done' ? 100
    : phase === 'learn' ? Math.round(((1 + (learnIdx + 1) / (SECTIONS.length + 1)) / 4) * 100)
    : Math.round((curIdx / 4) * 100);

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
  // Navigation: can jump to any phase up to the furthest one reached (never skip ahead).
  function goPhase(target: Phase, sectionIdx?: number) {
    if (ORDER.indexOf(target) > curIdx) return;
    if (typeof sectionIdx === 'number') setLearnIdx(sectionIdx);
    setPhase(target); setError(null); window.scrollTo({ top: 0 });
  }

  // ---- Sidebar ----
  const navRow = (active: boolean, enabled: boolean, done: boolean, icon: ReactNode, label: string, onClick: () => void) => (
    <button type="button" disabled={!enabled} onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition
        ${active ? 'bg-brand-600 text-white shadow-md shadow-brand-600/25'
          : enabled ? 'text-slate-700 hover:bg-slate-100' : 'cursor-default text-slate-300'}`}>
      <span className={`flex h-7 w-7 flex-none items-center justify-center rounded-lg ${active ? 'bg-white/20 text-white' : done ? 'bg-green-100 text-green-600' : enabled ? 'bg-slate-100 text-slate-500' : 'bg-slate-50 text-slate-300'}`}>
        {done && !active ? <CheckMark className="h-4 w-4" /> : icon}
      </span>
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
  const sidebar = (
    <nav className="flex h-full flex-col gap-1 overflow-hidden rounded-2xl bg-white/80 p-3 shadow-xl shadow-slate-900/10 ring-1 ring-white/60 backdrop-blur-md">
      {navRow(phase === 'intake', true, curIdx > 0, <SectionIcon name="expectations" className="h-4 w-4" />, t.steps.info, () => goPhase('intake'))}
      {navRow(phase === 'learn', curIdx >= 1, curIdx > 1, <SectionIcon name="quiz" className="h-4 w-4" />, t.steps.learn, () => goPhase('learn', learnIdx))}
      {phase === 'learn' && (
        <div className="mb-1 ml-5 space-y-0.5 border-l border-slate-200 pl-3">
          {SECTIONS.map((s, i) => (
            <button key={s.id} type="button" onClick={() => goPhase('learn', i)}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition
                ${i === learnIdx ? 'font-semibold text-brand-700' : 'text-slate-500 hover:text-slate-800'}`}>
              <span className={`h-1.5 w-1.5 flex-none rounded-full ${i === learnIdx ? 'bg-brand-600' : i < learnIdx ? 'bg-brand-100' : 'bg-slate-300'}`} />
              <span className="min-w-0 truncate">{s.title}</span>
            </button>
          ))}
        </div>
      )}
      {navRow(phase === 'quiz', curIdx >= 2, curIdx > 2, <SectionIcon name="quiz" className="h-4 w-4" />, t.steps.quiz, () => goPhase('quiz'))}
      {navRow(phase === 'signoff', curIdx >= 3, false, <SectionIcon name="signoff" className="h-4 w-4" />, t.steps.signoff, () => goPhase('signoff'))}

      <div className="mt-auto overflow-hidden rounded-xl bg-gradient-to-br from-brand-600 to-brand-900 p-4 text-white">
        <div className="font-[cursive] text-lg leading-tight">Clean Water,<br />Brighter Homes,<br />Stronger Communities</div>
        <div className="mt-2 text-[11px] text-white/70">Office: {dealerName}</div>
      </div>
    </nav>
  );

  // ---- DONE (certificate) ----
  if (phase === 'done' && result?.ok) {
    return (
      <>
        <TopBar t={t} pct={100} initials={initialsOf(name)} lang={lang} setLang={setLang} langs={available} showProgress={false} />
        <div className="mx-auto max-w-2xl px-4 py-8">
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
              <p className="mt-5 rounded-xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-500 ring-1 ring-slate-100">{tpl(t.signedBy, { sig: signature.trim(), n: RULES.length })}</p>
              <div className="mt-6 flex flex-wrap justify-center gap-2 print:hidden">
                <button onClick={() => window.print()} className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 hover:bg-brand-700">{t.print}</button>
              </div>
              <p className="mt-3 text-center text-xs text-slate-400 print:hidden">{t.doneFoot}</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  const card = 'rounded-2xl bg-white p-6 shadow-lg shadow-slate-300/30 ring-1 ring-slate-200 sm:p-7';

  return (
    <>
      <TopBar t={t} pct={pct} initials={initialsOf(name)} lang={lang} setLang={setLang} langs={available} showProgress />
      <div className="mx-auto flex max-w-[1500px] items-start gap-6 px-4 py-6">
        {/* Left section nav (desktop) */}
        <div className="hidden w-64 flex-none self-stretch lg:block">{sidebar}</div>

        {/* Main content — kept to the left so the hero photo shows through on the right */}
        <main className="w-full min-w-0 max-w-[760px]">
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-800">
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
                <div className="mb-5 flex flex-wrap gap-1.5">
                  {SECTIONS.map((_, i) => (
                    <span key={i} className={`h-1.5 rounded-full transition-all ${i === learnIdx ? 'w-6 bg-brand-600' : i < learnIdx ? 'w-1.5 bg-brand-100' : 'w-1.5 bg-slate-200'}`} />
                  ))}
                </div>
                <div className="space-y-3">{s.blocks.map((b, i) => <RenderBlock key={i} b={b} firstName={firstName} />)}</div>
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
        </main>
      </div>
    </>
  );
}
