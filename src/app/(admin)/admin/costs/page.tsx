import { requireAdminSection } from '@/lib/session';
import { getCostConfig, computeMonthlyCosts, usdToCadAmount, amountInCad } from '@/lib/costs';
import { placesConfigured } from '@/lib/googlePlaces';
import { aiUsageForMonth } from '@/lib/aiUsage';
import { getTwilioUsage, type TwilioUsage } from '@/lib/twilioUsage';
import { smsEnabled } from '@/lib/sms';
import { deeplUsage } from '@/lib/translate';
import { getStorageUsage } from '@/lib/storage-usage';
import { AiCostMeter } from '@/app/(admin)/admin/system-health/AiCostMeter';
import { TwilioUsageCard } from '@/app/(admin)/admin/email/TwilioUsageCard';
import { StorageMeter } from '@/app/(admin)/admin/StorageMeter';
import { CostsForm } from './CostsForm';

export const dynamic = 'force-dynamic';

const money = (n: number) => n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' });
const nf = (n: number) => n.toLocaleString('en-CA');

function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-CA', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export default async function CostsPage() {
  await requireAdminSection('costs');
  const smsOn = smsEnabled();

  const cfg = await getCostConfig();
  const [breakdown, aiUsage, deepl, storage, twilio] = await Promise.all([
    computeMonthlyCosts(cfg),
    aiUsageForMonth(),
    deeplUsage(),
    getStorageUsage().catch(() => null),
    // Twilio is a live API call — best-effort so it never blocks the page.
    smsOn ? getTwilioUsage().catch(() => null) : Promise.resolve(null as TwilioUsage | null),
  ]);
  const googleLive = placesConfigured();

  // Metered services that bill in USD/other, folded into the CAD total.
  const aiCad = usdToCadAmount(aiUsage.totals.costUsd, cfg.usdToCad);
  const twilioCad = twilio ? amountInCad(twilio.thisMonth.price, twilio.thisMonth.currency, cfg.usdToCad) : 0;
  const grandTotal = Math.round((breakdown.total + aiCad + twilioCad) * 100) / 100;

  // The combined line list: the base breakdown (Google + fixed), then the metered
  // services priced into CAD.
  const meteredLines = [
    {
      label: 'AI — assistant + lead-card reader (Anthropic)',
      detail: `$${aiUsage.totals.costUsd.toFixed(2)} USD × ${cfg.usdToCad} · ${nf(aiUsage.totals.calls)} calls`,
      amount: aiCad,
    },
    smsOn
      ? twilio
        ? {
            label: 'Texting — SMS (Twilio)',
            detail: `${nf(twilio.thisMonth.count)} texts${twilio.thisMonth.currency === 'CAD' ? '' : ` · ${twilio.thisMonth.price.toFixed(2)} ${twilio.thisMonth.currency} × ${cfg.usdToCad}`}`,
            amount: twilioCad,
          }
        : { label: 'Texting — SMS (Twilio)', detail: 'Live total unavailable right now — see the meter below', amount: null as number | null }
      : null,
  ].filter(Boolean) as { label: string; detail: string; amount: number | null }[];

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Costs</h1>
        <p className="mt-1 text-sm text-gray-500">
          Everything the portal costs to run each month, in one place — the metered services (Google lookups, AI,
          texting) counted automatically, plus your fixed AWS and service bills. Metered items are real; fixed bills
          are the amounts you enter below.
        </p>
      </div>

      {/* Headline total — a deliberate dark tile so it reads in both themes (the
          brand utility didn't paint a background, leaving white-on-white). */}
      <div className="rounded-lg bg-gray-900 p-6 text-white shadow-sm ring-1 ring-gray-800 dark:bg-slate-800 dark:ring-slate-700">
        <p className="text-sm font-medium text-gray-300">Estimated total — {monthLabel(breakdown.month)}</p>
        <p className="mt-1 text-4xl font-bold tracking-tight text-white">{money(grandTotal)}</p>
        <p className="mt-2 text-xs text-gray-400">
          Google, AI and texting are counted so far this month; the fixed bills are the amounts you enter below. AI and
          texting are billed in USD and converted at {cfg.usdToCad} (editable).
        </p>
      </div>

      {/* Breakdown */}
      <div className="card overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-3">
          <h2 className="text-base font-semibold text-gray-900">This month, line by line</h2>
        </div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-gray-100">
            {breakdown.lines.map((l) => (
              <tr key={l.label}>
                <td className="px-5 py-3">
                  <div className="font-medium text-gray-900">{l.label}</div>
                  <div className="text-xs text-gray-500">{l.detail}</div>
                </td>
                <td className="px-5 py-3 text-right">
                  {l.usageBased && (
                    <span className="mr-2 align-middle text-[10px] font-semibold uppercase tracking-wide text-emerald-600">metered</span>
                  )}
                  <span className="font-semibold tabular-nums text-gray-900">{money(l.amount)}</span>
                </td>
              </tr>
            ))}
            {meteredLines.map((l) => (
              <tr key={l.label}>
                <td className="px-5 py-3">
                  <div className="font-medium text-gray-900">{l.label}</div>
                  <div className="text-xs text-gray-500">{l.detail}</div>
                </td>
                <td className="px-5 py-3 text-right">
                  <span className="mr-2 align-middle text-[10px] font-semibold uppercase tracking-wide text-emerald-600">metered</span>
                  <span className="font-semibold tabular-nums text-gray-900">{l.amount == null ? '—' : money(l.amount)}</span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200 bg-gray-50">
              <td className="px-5 py-3 font-semibold text-gray-900">Total</td>
              <td className="px-5 py-3 text-right text-lg font-bold tabular-nums text-gray-900">{money(grandTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* --- The detailed meters, all gathered here --- */}

      {/* AI spend */}
      <AiCostMeter summary={aiUsage} />

      {/* Texting spend */}
      <div>
        <h2 className="mb-2 text-sm font-semibold text-gray-900">Texting (Twilio)</h2>
        <TwilioUsageCard enabled={smsOn} />
      </div>

      {/* Translation (DeepL) — usage, not a dollar line: free fallback kicks in at the limit */}
      <div className="card p-5">
        <div className="mb-1 flex items-center gap-3">
          <h2 className="text-base font-semibold text-gray-900">Translation (DeepL)</h2>
          <span className={`badge ${!deepl.configured ? 'bg-gray-100 text-gray-500' : deepl.ok ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
            {!deepl.configured ? 'Free fallback' : deepl.ok ? 'Connected' : 'Unavailable'}
          </span>
        </div>
        {!deepl.configured ? (
          <p className="text-xs text-gray-500">Running on the free MyMemory fallback — no charge. Add a DeepL key for higher quality and a usage meter.</p>
        ) : deepl.ok ? (
          (() => {
            const count = deepl.count ?? 0;
            const limit = deepl.limit ?? 0;
            const pct = limit > 0 ? Math.min(100, Math.round((count / limit) * 1000) / 10) : 0;
            const barCls = pct >= 95 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-sky-600';
            return (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-500">DeepL characters (free tier)</span>
                  <span className="text-xs font-semibold tabular-nums text-gray-600">{pct}% used</span>
                </div>
                <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                  <div className={`h-full ${barCls}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-2 text-xs text-gray-600 tabular-nums">
                  <strong>{nf(count)}</strong> of <strong>{nf(limit)}</strong> characters — at the limit it switches to the free fallback (no charge).
                </div>
              </>
            );
          })()
        ) : (
          <p className="text-xs text-amber-700">Couldn’t read DeepL usage. The free MyMemory fallback still covers translation.</p>
        )}
      </div>

      {/* Storage (part of the AWS S3 line above) */}
      {storage && <StorageMeter usage={storage} />}

      {/* Google usage detail */}
      <div className="card p-5">
        <div className="mb-3 flex items-center gap-3">
          <h2 className="text-base font-semibold text-gray-900">Google address lookups</h2>
          <span className={`badge ${googleLive ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
            {googleLive ? 'Connected' : 'Not configured'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="rounded-lg bg-gray-50 p-3">
            <div className="text-2xl font-bold tabular-nums text-gray-900">{nf(breakdown.google.autocompleteCalls)}</div>
            <div className="text-xs text-gray-500">Autocomplete calls</div>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <div className="text-2xl font-bold tabular-nums text-gray-900">{nf(breakdown.google.detailsCalls)}</div>
            <div className="text-xs text-gray-500">Details calls</div>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <div className="text-2xl font-bold tabular-nums text-gray-900">{money(breakdown.google.netCost)}</div>
            <div className="text-xs text-gray-500">Google cost this month</div>
          </div>
        </div>
      </div>

      {/* Editable settings */}
      <div className="card p-6">
        <h2 className="mb-1 text-base font-semibold text-gray-900">Rates &amp; fixed bills</h2>
        <p className="mb-4 text-sm text-gray-500">
          The fixed amounts are starting estimates — replace them with your actual monthly bills. Changes take effect
          immediately (no redeploy).
        </p>
        <CostsForm cfg={cfg} />
      </div>
    </div>
  );
}
