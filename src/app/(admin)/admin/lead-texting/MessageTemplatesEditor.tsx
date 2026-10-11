'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import {
  LEAD_TEXT_KINDS, LEAD_TEXT_TOKENS, renderLeadTextTemplate, leadTextVars, smsSegments,
  type LeadTextKind,
} from '@/lib/leadTextTemplate';
import { saveLeadTextTemplateAction, resetLeadTextTemplateAction, aiWriteLeadTextAction } from '@/app/(admin)/actions';
import type { ActionState } from '@/app/(admin)/actions';

type Lang = 'en' | 'fr';
interface Tmpl { body: string; overridden: boolean }
type Templates = Record<LeadTextKind, Record<Lang, Tmpl>>;

// Sample customer used to render the live preview.
const SAMPLE = { en: { firstName: 'Robyn Scott', street: '118 Scott St', city: 'Barrie' }, fr: { firstName: 'Marc Tremblay', street: '12 Rue Principale', city: 'Gatineau' } };

function SaveBtn() {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn-primary text-sm" disabled={pending}>{pending ? 'Saving…' : 'Save message'}</button>;
}

export function MessageTemplatesEditor({
  templates, aiAvailable, bookingSample, infoUrl,
}: {
  templates: Templates;
  aiAvailable: boolean;
  bookingSample: string;
  infoUrl: string;
}) {
  const [kind, setKind] = useState<LeadTextKind>('CONFIRM');
  const [lang, setLang] = useState<Lang>('en');
  // Local edits keyed by kind:lang, falling back to the saved template.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [aiBusy, startAi] = useTransition();
  const taRef = useRef<HTMLTextAreaElement>(null);

  const [saveState, saveAction] = useFormState(saveLeadTextTemplateAction, {} as ActionState);
  const [resetState, resetAction] = useFormState(resetLeadTextTemplateAction, {} as ActionState);

  const dk = `${kind}:${lang}`;
  const saved = templates[kind][lang];
  const body = dk in drafts ? drafts[dk] : saved.body;
  const setBody = (v: string) => setDrafts((p) => ({ ...p, [dk]: v }));

  const preview = useMemo(() => {
    const s = SAMPLE[lang];
    return renderLeadTextTemplate(body, leadTextVars({ ...s, bookingUrl: bookingSample, infoUrl }, lang));
  }, [body, lang, bookingSample, infoUrl]);
  const segs = smsSegments(preview);

  function insertToken(tok: string) {
    const ta = taRef.current;
    const s = ta?.selectionStart ?? body.length;
    const e = ta?.selectionEnd ?? body.length;
    const next = body.slice(0, s) + tok + body.slice(e);
    setBody(next);
    requestAnimationFrame(() => { if (ta) { ta.focus(); ta.selectionStart = ta.selectionEnd = s + tok.length; } });
  }

  function runAi(instruction: string, note: string) {
    setAiNote(null);
    const fd = new FormData();
    fd.set('lang', lang); fd.set('current', body); fd.set('instruction', instruction);
    startAi(async () => {
      const res = await aiWriteLeadTextAction(fd);
      if (res.error) { setAiNote(res.error); return; }
      if (res.text) { setBody(res.text); setAiNote(note); }
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[176px_minmax(0,1fr)_280px]">
      {/* message list */}
      <div className="flex flex-row gap-2 overflow-x-auto lg:flex-col">
        {LEAD_TEXT_KINDS.map((m) => {
          const customized = templates[m.key].en.overridden || templates[m.key].fr.overridden;
          return (
            <button key={m.key} type="button" onClick={() => { setKind(m.key); setAiNote(null); }}
              className={`shrink-0 rounded-lg border p-2.5 text-left lg:shrink ${kind === m.key ? 'border-brand-500 bg-brand-50 dark:border-sky-700 dark:bg-sky-950/30' : 'border-gray-200 hover:border-gray-300 dark:border-slate-700'}`}>
              <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-slate-100">{m.label}{customized && <span className="h-1.5 w-1.5 rounded-full bg-brand-500" title="Customized" />}</div>
              <div className="mt-0.5 hidden text-[11px] text-gray-500 lg:block dark:text-slate-400">{m.when}</div>
            </button>
          );
        })}
      </div>

      {/* editor */}
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="inline-flex overflow-hidden rounded-lg border border-gray-200 dark:border-slate-700">
            {(['en', 'fr'] as const).map((l) => (
              <button key={l} type="button" onClick={() => { setLang(l); setAiNote(null); }}
                className={`px-3 py-1 text-xs font-semibold ${lang === l ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                {l === 'en' ? 'English' : 'Français'}
              </button>
            ))}
          </div>
          {saved.overridden && <span className="text-[11px] font-medium text-brand-600 dark:text-sky-400">Customized · not the default</span>}
        </div>

        <form action={saveAction} className="space-y-2">
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="lang" value={lang} />
          <textarea ref={taRef} name="body" value={body} onChange={(e) => setBody(e.target.value)} rows={9}
            className="input w-full font-mono text-[13px] leading-relaxed" spellCheck />

          <div className="flex flex-wrap gap-1.5">
            {LEAD_TEXT_TOKENS.map((t) => (
              <button key={t.token} type="button" onClick={() => insertToken(t.token)} title={t.hint}
                className="rounded-md border border-violet-200 bg-violet-50 px-2 py-1 font-mono text-[11px] text-violet-700 hover:brightness-95 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-300">
                {t.token}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-gray-400 dark:text-slate-500">Click a field to drop it in. Missing info falls back gracefully — no empty “Hi ,”. Keep a STOP line and the Info link (CASL).</p>

          {aiAvailable && (
            <div className="flex flex-wrap gap-2 border-t border-dashed border-gray-100 pt-2.5 dark:border-slate-700">
              {[
                ['Make friendlier', 'make it warmer and friendlier', '✨ Rewrote it friendlier — review, then Save.'],
                ['Make shorter', 'make it shorter, fewer segments, keep the key info', '✨ Tightened it up — review, then Save.'],
                ['Fix spacing', 'improve the spacing into short readable blocks with blank lines', '✨ Re-spaced into short blocks — review, then Save.'],
                [lang === 'en' ? 'Translate → FR' : 'Translate → EN', `translate this into ${lang === 'en' ? 'French' : 'English'} (Canadian), keeping the merge fields`, '✨ Translated — review, then Save.'],
              ].map(([label, instr, note]) => (
                <button key={label} type="button" disabled={aiBusy} onClick={() => runAi(instr, note)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:border-brand-300 hover:text-brand-700 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                  <span className="text-violet-500">✨</span> {label}
                </button>
              ))}
              {aiBusy && <span className="self-center text-xs text-gray-400">Writing…</span>}
            </div>
          )}
          {aiNote && <div className="rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-700 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-300">{aiNote}</div>}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <SaveBtn />
            <button type="submit" formAction={resetAction} className="btn-secondary text-sm">Reset to default</button>
            {saveState.error && <span className="text-xs text-red-600">{saveState.error}</span>}
            {saveState.ok && <span className="text-xs text-green-600">{saveState.message}</span>}
            {resetState.ok && <span className="text-xs text-green-600">{resetState.message}</span>}
          </div>
        </form>
      </div>

      {/* phone preview */}
      <div className="lg:sticky lg:top-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-2 border-b border-gray-100 pb-2 text-center dark:border-slate-700">
            <div className="text-sm font-semibold text-gray-900 dark:text-slate-100">HD Home Services</div>
            <div className="text-[11px] text-gray-400">Text message · now</div>
          </div>
          <div className="whitespace-pre-wrap break-words rounded-2xl rounded-bl-md bg-slate-50 p-3 text-[13px] text-gray-800 dark:bg-slate-700/40 dark:text-slate-100">{preview}</div>
          <div className="mt-2 flex justify-between font-mono text-[11px] text-gray-400">
            <span>{preview.length} chars</span><span>{segs} segment{segs === 1 ? '' : 's'}</span>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-gray-400 dark:text-slate-500">Live preview with sample customer “{SAMPLE[lang].firstName.split(' ')[0]}”. The real text uses each customer’s own name &amp; street.</p>
      </div>
    </div>
  );
}
