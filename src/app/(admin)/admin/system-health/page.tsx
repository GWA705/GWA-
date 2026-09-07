import Link from 'next/link';
import { requireAdminSection } from '@/lib/session';
import { getSystemHealth, type HealthCheck } from '@/lib/health';
import { deeplUsage } from '@/lib/translate';
import { CopyField } from '@/app/(staff)/staff/reports/connection/CopyField';
import { getSetting, AI_SETTING_KEYS } from '@/lib/settings';
import { TranslateHealthCheck } from './TranslateHealthCheck';
import { AiCostCalculator } from './AiCostCalculator';
import { AssistantKnowledge } from './AssistantKnowledge';

export const dynamic = 'force-dynamic';

const nf = (n: number) => n.toLocaleString('en-CA');

function UsageBody({ usage }: { usage: Awaited<ReturnType<typeof deeplUsage>> }) {
  if (!usage.configured) {
    return (
      <p className="mt-1 text-xs text-gray-600">
        No DeepL key set — reviewer translation is running on the free <strong>MyMemory</strong> fallback.
        Add <code>DEEPL_API_KEY</code> in Render for higher quality and a usage meter.
      </p>
    );
  }
  if (!usage.ok) {
    return (
      <p className="mt-1 text-xs text-amber-700">
        Couldn’t read DeepL usage ({usage.error ?? 'unknown'}). The free MyMemory fallback still covers translation if DeepL is unavailable.
      </p>
    );
  }
  const count = usage.count ?? 0;
  const limit = usage.limit ?? 0;
  const pct = limit > 0 ? Math.min(100, Math.round((count / limit) * 1000) / 10) : 0;
  const remaining = Math.max(0, limit - count);
  const near = pct >= 80;
  const barCls = pct >= 95 ? 'bg-red-500' : near ? 'bg-amber-500' : 'bg-sky-600';
  return (
    <>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="text-xs text-gray-500">DeepL characters</span>
        <span className="text-xs font-semibold tabular-nums text-gray-600">{pct}% used</span>
      </div>
      <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full ${barCls}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-600 tabular-nums">
        <span><strong>{nf(count)}</strong> used</span>
        <span><strong>{nf(remaining)}</strong> remaining</span>
        <span>of <strong>{nf(limit)}</strong> characters</span>
      </div>
      <p className="mt-2 text-xs text-gray-500">
        {near
          ? 'Running low — at the limit, translation automatically switches to the free MyMemory fallback (no interruption, no charge).'
          : 'If this ever runs out, translation automatically switches to the free MyMemory fallback — no interruption, no charge.'}
      </p>
    </>
  );
}

function TranslationCard({ usage }: { usage: Awaited<ReturnType<typeof deeplUsage>> }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
      <h2 className="text-sm font-semibold text-gray-900">Translation</h2>
      <UsageBody usage={usage} />
      <TranslateHealthCheck />
    </div>
  );
}

function StatusBadge({ status }: { status: HealthCheck['status'] }) {
  const map: Record<HealthCheck['status'], { label: string; cls: string }> = {
    ok: { label: 'Connected', cls: 'bg-green-100 text-green-800' },
    warn: { label: 'Attention', cls: 'bg-amber-100 text-amber-800' },
    error: { label: 'Error', cls: 'bg-red-100 text-red-700' },
    notset: { label: 'Not set', cls: 'bg-gray-100 text-gray-500' },
  };
  const m = map[status];
  return <span className={`badge shrink-0 ${m.cls}`}>{m.label}</span>;
}

function Dot({ status }: { status: HealthCheck['status'] }) {
  const c =
    status === 'ok' ? 'bg-green-500' : status === 'warn' ? 'bg-amber-500' : status === 'error' ? 'bg-red-500' : 'bg-gray-300';
  return <span className={`mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${c}`} />;
}

export default async function SystemHealthPage() {
  await requireAdminSection('system-health');
  const [health, usage, assistantKnowledge] = await Promise.all([
    getSystemHealth(),
    deeplUsage(),
    getSetting(AI_SETTING_KEYS.assistantKnowledge),
  ]);

  const groups: HealthCheck['group'][] = ['Core', 'Google Workspace'];

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">System health</h1>
          <p className="mt-1 text-sm text-gray-600">
            Live status of every connection feeding the portal. Checked fresh each time this page loads.
          </p>
        </div>
        <Link href="/admin/system-health" className="btn-secondary text-sm">Recheck</Link>
      </div>

      {/* Summary */}
      <div className="flex flex-wrap gap-3">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm px-4 py-3">
          <div className="text-lg font-bold text-emerald-600 tabular-nums">{health.okCount}</div>
          <div className="text-[10px] uppercase text-gray-500">Connected</div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm px-4 py-3">
          <div className={`text-lg font-bold tabular-nums ${health.problemCount ? 'text-red-600' : 'text-gray-400'}`}>
            {health.problemCount}
          </div>
          <div className="text-[10px] uppercase text-gray-500">Errors</div>
        </div>
      </div>

      {/* AI assistant: knowledge editor + cost estimator */}
      <AssistantKnowledge initial={assistantKnowledge ?? ''} />
      <AiCostCalculator />

      {/* Translation usage, fallback + live test */}
      <TranslationCard usage={usage} />

      {/* Service account share address */}
      {health.serviceAccountEmail && (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-900">Service account to share sheets with</h2>
          <p className="mt-1 text-xs text-gray-500">
            Share every Google Sheet below with this address (Viewer) so the portal can read it.
          </p>
          <div className="mt-3">
            <CopyField value={health.serviceAccountEmail} />
          </div>
        </div>
      )}

      {groups.map((group) => {
        const items = health.checks.filter((c) => c.group === group);
        if (items.length === 0) return null;
        return (
          <div key={group} className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-3">
              <h2 className="text-sm font-semibold text-gray-900">{group}</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {items.map((c) => (
                <div key={c.key} className="flex items-start gap-3 px-5 py-3">
                  <Dot status={c.status} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{c.label}</span>
                      <StatusBadge status={c.status} />
                    </div>
                    {c.detail && <div className="mt-0.5 break-words text-xs text-gray-500">{c.detail}</div>}
                    {c.hint && <div className="mt-0.5 text-xs text-sky-600">→ {c.hint}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <p className="text-[11px] text-gray-400">
        A round-trip write/read is used to verify file storage; sheets are opened read-only through the service
        account. Nothing here is cached.
      </p>
    </div>
  );
}
