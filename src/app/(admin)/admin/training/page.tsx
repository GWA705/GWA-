import Link from 'next/link';
import { requireAdminSection } from '@/lib/session';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Company-wide lead-generator training record, across every office. This is the
// view Home Depot wants: who has been trained, where, when, and the result.
export default async function AdminTrainingPage({ searchParams }: { searchParams: { office?: string } }) {
  await requireAdminSection('training');

  const officeFilter = searchParams.office && searchParams.office !== 'all' ? searchParams.office : null;

  const [certs, offices, activeOffices] = await Promise.all([
    prisma.trainingCertification.findMany({
      where: officeFilter ? { dealerId: officeFilter } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: {
        id: true, traineeName: true, traineeEmail: true, traineePhone: true,
        score: true, passed: true, createdAt: true,
        dealer: { select: { id: true, name: true } },
      },
    }),
    // Offices that have at least one completion, for the filter dropdown.
    prisma.dealer.findMany({
      where: { trainingCertifications: { some: {} } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    // All active offices, for the "preview as a trainee" picker.
    prisma.dealer.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ]);

  const total = certs.length;
  const passed = certs.filter((c) => c.passed).length;
  const distinctOffices = new Set(certs.map((c) => c.dealer?.id)).size;
  const exportHref = officeFilter ? `/admin/training/export?office=${officeFilter}` : '/admin/training/export';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Training records</h1>
          <p className="mt-1 text-sm text-gray-500">
            Lead-generator training &amp; certification across all offices. Retained for Home Depot compliance.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/training/editor"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Edit quiz &amp; rules
          </Link>
          <a
            href={exportHref}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Download CSV
          </a>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-slate-50/60 p-4">
        <div className="text-sm font-semibold text-gray-900">See it as a lead generator would</div>
        <p className="mt-0.5 text-xs text-gray-500">Opens the live training for an office in a new tab — the exact page a new lead generator sees (no login). Use the EN/FR toggle at the top of it to check French.</p>
        <form action="/admin/training/preview" method="get" target="_blank" className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <select name="office" required defaultValue="" className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm">
            <option value="" disabled>Choose an office…</option>
            {activeOffices.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
          <button type="submit" className="rounded-lg bg-gray-900 px-4 py-1.5 font-semibold text-white hover:bg-black">Preview training ↗</button>
        </form>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wide text-gray-400">Completions</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{total}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wide text-gray-400">Passed</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{passed}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wide text-gray-400">Offices</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{distinctOffices}</div>
        </div>
      </div>

      <form method="get" className="flex items-center gap-2 text-sm">
        <label htmlFor="office" className="text-gray-500">Office</label>
        <select
          id="office"
          name="office"
          defaultValue={officeFilter ?? 'all'}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
        >
          <option value="all">All offices</option>
          {offices.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
        <button type="submit" className="rounded-lg border border-gray-200 px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50">Filter</button>
      </form>

      <div className="card p-6">
        {certs.length === 0 ? (
          <p className="text-sm text-gray-500">No training completions recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                  <th className="py-1.5 pr-3">Name</th>
                  <th className="py-1.5 pr-3">Office</th>
                  <th className="py-1.5 pr-3">Email</th>
                  <th className="py-1.5 pr-3">Score</th>
                  <th className="py-1.5 pr-3">Result</th>
                  <th className="py-1.5 pr-3">Date</th>
                  <th className="py-1.5">Certificate</th>
                </tr>
              </thead>
              <tbody>
                {certs.map((c) => (
                  <tr key={c.id} className="border-b border-gray-50">
                    <td className="py-1.5 pr-3 font-medium text-gray-800">{c.traineeName}</td>
                    <td className="py-1.5 pr-3 text-gray-600">{c.dealer?.name ?? '—'}</td>
                    <td className="py-1.5 pr-3 text-gray-500">{c.traineeEmail}</td>
                    <td className="py-1.5 pr-3 tabular-nums text-gray-700">{c.score}%</td>
                    <td className="py-1.5 pr-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${c.passed ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>{c.passed ? 'Passed' : 'Incomplete'}</span>
                    </td>
                    <td className="py-1.5 pr-3 text-xs text-gray-400">{c.createdAt.toLocaleDateString('en-CA')}</td>
                    <td className="py-1.5"><Link href={`/admin/training/${c.id}`} className="text-xs font-medium text-brand-600 hover:underline">View</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
