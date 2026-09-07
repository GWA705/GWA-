'use client';

import { useState, useTransition } from 'react';
import { saveAssistantKnowledge } from './actions';
import type { AssistantArea } from '@/lib/settings';

export interface KnowledgeArea {
  area: AssistantArea;
  label: string;
  value: string;
}

const HINTS: Record<AssistantArea, string> = {
  general: 'Always applies. Portal basics, tone, who to contact, anything that spans every area.',
  marketplace: 'Ordering gear & materials: how to order, product questions, order status, shipping, returns.',
  deals: 'Credit applications / deals: how to submit, statuses, what reviewers need, consent, funding paperwork.',
  leads: 'Home Depot leads: working leads, the map, statuses (New / Working / Booked & sold / No-good).',
  giftcards: 'Water-test gift cards: who qualifies, how to request, timing, redemption.',
  products: 'Products & equipment: models, specs, features, pricing notes, and what to link in the Product Library. Applied when a dealer is browsing products/resources.',
};

/**
 * Admin editor for the AI assistant's team knowledge, per area. General always
 * applies; each area's text is added on top when a dealer chats from that part of
 * the portal. Saved to app settings and injected into the system prompt — editing
 * here "trains" the assistant, no deploy needed.
 */
export function AssistantKnowledge({ areas }: { areas: KnowledgeArea[] }) {
  const [tab, setTab] = useState<AssistantArea>(areas[0]?.area ?? 'general');
  // Working copy + last-saved value per area.
  const [text, setText] = useState<Record<string, string>>(() => Object.fromEntries(areas.map((a) => [a.area, a.value])));
  const [saved, setSaved] = useState<Record<string, string>>(() => Object.fromEntries(areas.map((a) => [a.area, a.value])));
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const cur = text[tab] ?? '';
  const dirty = cur !== (saved[tab] ?? '');

  function save() {
    setStatus(null);
    startTransition(async () => {
      const r = await saveAssistantKnowledge(tab, cur);
      if (r.ok) {
        setSaved((s) => ({ ...s, [tab]: cur }));
        setStatus({ ok: true, msg: 'Saved — used on the next reply from this area.' });
      } else {
        setStatus({ ok: false, msg: r.error ?? 'Could not save.' });
      }
    });
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
      <h2 className="text-sm font-semibold text-gray-900">AI assistant — team knowledge</h2>
      <p className="mt-1 text-xs text-gray-500">
        What the support assistant knows and how it answers, in your own words. <strong>General</strong> always applies; each area
        is added on top when a dealer chats from that part of the portal (Marketplace answers differ from Deals answers). Editing
        here &ldquo;trains&rdquo; the assistant — no deploy needed.
      </p>

      {/* area tabs */}
      <div className="mt-3 overflow-x-auto pb-1">
        <div className="inline-flex gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1">
          {areas.map((a) => {
            const has = (text[a.area] ?? '').trim().length > 0;
            const active = a.area === tab;
            return (
              <button
                key={a.area}
                type="button"
                onClick={() => { setTab(a.area); setStatus(null); }}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  active ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-blue-700'
                }`}
              >
                {a.label}
                {has && <span className={`ml-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle ${active ? 'bg-blue-500' : 'bg-emerald-400'}`} />}
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-2 text-[11px] text-gray-400">{HINTS[tab]}</p>
      <textarea
        value={cur}
        onChange={(e) => { setText((t) => ({ ...t, [tab]: e.target.value })); if (status) setStatus(null); }}
        rows={12}
        className="mt-2 w-full resize-y rounded-lg border border-gray-300 p-3 text-sm leading-relaxed focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] text-gray-400 tabular-nums">{cur.length.toLocaleString('en-CA')} / 20,000 characters</span>
        <div className="flex items-center gap-3">
          {status && <span className={`text-xs ${status.ok ? 'text-emerald-600' : 'text-red-600'}`}>{status.msg}</span>}
          <button type="button" onClick={save} disabled={pending || !dirty} className="btn-primary text-sm disabled:opacity-50">
            {pending ? 'Saving…' : dirty ? 'Save' : 'Saved'}
          </button>
        </div>
      </div>
    </div>
  );
}
