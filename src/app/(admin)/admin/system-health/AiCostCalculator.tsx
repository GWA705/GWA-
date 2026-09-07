'use client';

import { useState } from 'react';

/**
 * Estimator for the dealer support assistant's Anthropic cost. Pure client-side
 * math — no API calls. Prices are Anthropic first-party API rates (USD per 1M
 * tokens) as of 2026-06; check the Anthropic Console → Usage for actuals.
 */
const MODELS = [
  { id: 'claude-haiku-4-5', name: 'Haiku 4.5', inPrice: 1, outPrice: 5, note: 'Cheapest — good for high volume', current: false },
  { id: 'claude-sonnet-5', name: 'Sonnet 5', inPrice: 2, outPrice: 10, note: 'Current default — sharp answers', current: true },
  { id: 'claude-opus-5', name: 'Opus 5', inPrice: 5, outPrice: 25, note: 'Most capable', current: false },
];

const AVG_DAYS_PER_MONTH = 30.4;

function money(n: number): string {
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(5)}`;
}

function NumField({
  label,
  value,
  onChange,
  min,
  step,
  hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  step: number;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        step={step}
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm tabular-nums focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
      {hint && <span className="mt-1 block text-[11px] text-gray-400">{hint}</span>}
    </label>
  );
}

export function AiCostCalculator() {
  // Defaults grounded in the assistant: system prompt (~700 tok) + a few history
  // turns (~500) ≈ 1,200 input; short answers ≈ 180 output (max_tokens 500).
  const [perDay, setPerDay] = useState(40);
  const [inTok, setInTok] = useState(1200);
  const [outTok, setOutTok] = useState(180);

  const rows = MODELS.map((m) => {
    const perReply = (inTok / 1_000_000) * m.inPrice + (outTok / 1_000_000) * m.outPrice;
    const perMonth = perReply * perDay * AVG_DAYS_PER_MONTH;
    return { ...m, perReply, perMonth };
  });

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
      <h2 className="text-sm font-semibold text-gray-900">AI assistant — cost estimator</h2>
      <p className="mt-1 text-xs text-gray-500">
        Rough monthly cost of the dealer support assistant, by model. Adjust the assumptions; the table updates live.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <NumField label="Assistant replies / day" value={perDay} onChange={setPerDay} min={0} step={5} hint="Dealer messages that get an AI reply" />
        <NumField label="Avg input tokens / reply" value={inTok} onChange={setInTok} min={0} step={100} hint="System prompt + recent chat history" />
        <NumField label="Avg output tokens / reply" value={outTok} onChange={setOutTok} min={0} step={20} hint="Length of the assistant's answer" />
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[440px] text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-[11px] uppercase tracking-wide text-gray-400">
              <th className="py-2 pr-2 font-medium">Model</th>
              <th className="py-2 px-2 text-right font-medium">$/reply</th>
              <th className="py-2 px-2 text-right font-medium">$/day</th>
              <th className="py-2 pl-2 text-right font-medium">Est. $/month</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.id} className={r.current ? 'bg-sky-50/60' : ''}>
                <td className="py-2.5 pr-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{r.name}</span>
                    {r.current && <span className="badge bg-sky-100 text-sky-700">In use</span>}
                  </div>
                  <div className="text-[11px] text-gray-400">{r.note}</div>
                </td>
                <td className="py-2.5 px-2 text-right tabular-nums text-gray-600">{money(r.perReply)}</td>
                <td className="py-2.5 px-2 text-right tabular-nums text-gray-600">{money(r.perReply * perDay)}</td>
                <td className="py-2.5 pl-2 text-right font-bold tabular-nums text-[#0e2b5c]">{money(r.perMonth)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-gray-400">
        Estimate only — Anthropic first-party API rates (USD/1M tokens: Haiku 4.5 $1/$5, Sonnet 5 $2/$10, Opus 5 $5/$25, input/output).
        Real usage varies with conversation length and volume; prompt caching can lower the input cost further. Track actuals in the
        Anthropic Console → Usage (filter by the “Portal.ghsbarrie.ca” key). Change the model with <code>ANTHROPIC_MODEL</code> in Render.
      </p>
    </div>
  );
}
