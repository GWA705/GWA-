import type { AiUsageSummary } from '@/lib/aiUsage';

/**
 * Real AI spend this month, measured from actual token usage (see lib/aiUsage.ts)
 * — the dealer-support assistant and the lead-card reader. USD, matching how
 * Anthropic bills. This is the actuals counterpart to the what-if cost estimator.
 */

const nf = (n: number) => n.toLocaleString('en-CA');

function money(n: number): string {
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(3)}`;
  if (n > 0) return `$${n.toFixed(5)}`;
  return '$0.00';
}

function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m) return month;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-CA', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function AiCostMeter({ summary }: { summary: AiUsageSummary }) {
  const { totals, byService, byModel, hasData } = summary;
  // Share of the bar per service, for a simple stacked meter of where spend goes.
  const maxCost = Math.max(totals.costUsd, 0.0000001);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">AI spend this month</h3>
          <p className="mt-0.5 text-xs text-gray-500">Measured from real usage · {monthLabel(summary.month)} · USD</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-extrabold leading-none text-[#0e2b5c] tabular-nums">{money(totals.costUsd)}</div>
          <div className="mt-1 text-[11px] text-gray-400 tabular-nums">{nf(totals.calls)} calls</div>
        </div>
      </div>

      {!hasData ? (
        <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
          No AI usage recorded yet this month. Spend appears here as the card reader and support assistant are used —
          metering started when this was deployed, so earlier usage isn’t counted. The full billing history is in the
          Anthropic Console (filter by the “Portal.ghsbarrie.ca” key).
        </p>
      ) : (
        <>
          {/* Where the spend goes, by feature */}
          <div className="mt-4 space-y-2.5">
            {byService.map((s) => {
              const pct = Math.round((s.costUsd / maxCost) * 1000) / 10;
              return (
                <div key={s.service}>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-gray-700">{s.label}</span>
                    <span className="tabular-nums text-gray-600">
                      <strong>{money(s.costUsd)}</strong> · {nf(s.calls)} calls
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full bg-brand-600" style={{ width: `${Math.max(2, pct)}%` }} />
                  </div>
                  <div className="mt-0.5 text-[10.5px] text-gray-400 tabular-nums">
                    {nf(s.inputTokens)} in · {nf(s.outputTokens)} out tokens
                  </div>
                </div>
              );
            })}
          </div>

          {/* Per-model split */}
          {byModel.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {byModel.map((m) => (
                <span
                  key={m.model}
                  className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 px-2.5 py-1 text-[11px] text-gray-600"
                  title={m.known ? undefined : 'Model not in the rate table — cost is an estimate'}
                >
                  <span className="font-semibold text-gray-800">{m.model}</span>
                  <span className="tabular-nums">{money(m.costUsd)}</span>
                  {!m.known && <span className="text-amber-600">≈</span>}
                </span>
              ))}
            </div>
          )}
        </>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-gray-400">
        Priced at Anthropic first-party rates (USD/1M tokens: Opus 5 $5/$25, Sonnet 5 $2/$10, Haiku 4.5 $1/$5, in/out).
        A tiny fraction of a cent per call may be lost to rounding. The card reader’s model is set by{' '}
        <code>CARD_AI_MODEL</code>, the assistant’s by <code>ANTHROPIC_MODEL</code>.
      </p>
    </div>
  );
}
