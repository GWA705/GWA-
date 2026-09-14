import Link from 'next/link';
import { requireSuperAdmin } from '@/lib/session';
import { reportVisibilityMatrix, REPORT_LEVELS } from '@/lib/reporting/visibility';
import { ReportLevelSelect } from './ReportLevelSelect';

export const dynamic = 'force-dynamic';

/** Super-admin control: set who can see each report. Defaults match the built-in
 * gating, so nothing changes until a report is switched here. */
export default async function ReportVisibilityPage() {
  await requireSuperAdmin();
  const matrix = await reportVisibilityMatrix();
  const dealer = matrix.filter((m) => m.group === 'dealer');
  const staff = matrix.filter((m) => m.group === 'staff');
  const levelOptions = REPORT_LEVELS.map((l) => ({ value: l.value, label: l.label }));

  const Section = ({ title, rows }: { title: string; rows: typeof matrix }) => (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-5 py-3">
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
      </div>
      <div className="divide-y divide-gray-100">
        {rows.map((r) => (
          <div key={r.key} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-900">{r.label}</div>
              <div className="text-xs text-gray-400">
                Default: {REPORT_LEVELS.find((l) => l.value === r.defaultLevel)?.label}
                {r.grantNote ? ` · grant = ${r.grantNote}` : ''}
                {r.level !== r.defaultLevel ? ' · changed' : ''}
              </div>
            </div>
            <ReportLevelSelect reportKey={r.key} level={r.level} levels={levelOptions} />
          </div>
        ))}
      </div>
    </section>
  );

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin" className="text-sm text-gray-500 hover:underline">← Admin</Link>
        <h1 className="mt-2 text-xl font-semibold text-gray-900">Report visibility</h1>
        <p className="mt-1 max-w-3xl text-sm text-gray-600">
          Choose who can open each report. Changes apply immediately — a report is hidden from its tab list <em>and</em>
          blocked at the page for anyone below the chosen level. Defaults match the built-in access, so nothing changes
          until you switch a report here.
        </p>
      </div>

      <section className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">What each level means</h2>
        <ul className="space-y-1 text-gray-700">
          {REPORT_LEVELS.map((l) => (
            <li key={l.value}>
              <span className="font-semibold">{l.label}:</span> {l.who}
            </li>
          ))}
        </ul>
      </section>

      <Section title="Dealer-facing reports" rows={dealer} />
      <Section title="Staff reports" rows={staff} />
    </div>
  );
}
