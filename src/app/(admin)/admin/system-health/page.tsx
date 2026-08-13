import Link from 'next/link';
import { requireAdminSection } from '@/lib/session';
import { getSystemHealth, type HealthCheck } from '@/lib/health';
import { CopyField } from '@/app/(staff)/staff/reports/connection/CopyField';

export const dynamic = 'force-dynamic';

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
  const health = await getSystemHealth();

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
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <div className="text-lg font-bold text-emerald-600 tabular-nums">{health.okCount}</div>
          <div className="text-[10px] uppercase text-gray-500">Connected</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <div className={`text-lg font-bold tabular-nums ${health.problemCount ? 'text-red-600' : 'text-gray-400'}`}>
            {health.problemCount}
          </div>
          <div className="text-[10px] uppercase text-gray-500">Errors</div>
        </div>
      </div>

      {/* Service account share address */}
      {health.serviceAccountEmail && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
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
          <div key={group} className="rounded-xl border border-gray-200 bg-white">
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
