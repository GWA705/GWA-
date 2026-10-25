import Link from 'next/link';
import type { IdTagStatus } from '@prisma/client';
import { requireStaffSection } from '@/lib/session';
import { prisma } from '@/lib/db';
import {
  listAllIdTags, idTagCounts, ID_TAG_STATUS_LABEL, ID_TAG_STATUS_TONE, TONE_CLASS, isIdTagStatus,
  daysUntil, expiryTone, expiryLabel,
} from '@/lib/idTag';

export const dynamic = 'force-dynamic';

const STATUS_KEYS = Object.keys(ID_TAG_STATUS_LABEL) as IdTagStatus[];

/**
 * Staff → ID tags — the reviewer tracking centre. Any reviewer (and admins with
 * the 'id-tags' section) sees everyone across every office, searches by name /
 * email / phone / badge #, and opens a person to run their Entuitive setup,
 * upload the card and set the expiry.
 */
export default async function StaffIdTagBoardPage({ searchParams }: { searchParams: { q?: string; status?: string; dealerId?: string } }) {
  await requireStaffSection('id-tags');

  const q = (searchParams.q || '').trim();
  const statusFilter = searchParams.status && isIdTagStatus(searchParams.status) ? searchParams.status : undefined;
  const dealerFilter = searchParams.dealerId || undefined;

  const [rows, counts, dealers] = await Promise.all([
    listAllIdTags({ q, status: statusFilter, dealerId: dealerFilter }),
    idTagCounts(),
    prisma.dealer.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);

  const card = 'rounded-2xl bg-white shadow-sm ring-1 ring-slate-200';
  const tiles = [
    { n: counts.needsTraining, label: 'Needs training', color: 'text-amber-700' },
    { n: counts.awaitingScreening, label: 'In screening', color: 'text-blue-700' },
    { n: counts.approved, label: 'Approved', color: 'text-indigo-700' },
    { n: counts.issued, label: 'Tags issued', color: 'text-green-700' },
    { n: counts.hasTag, label: 'Active', color: 'text-slate-700' },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-slate-900">HD ID Tags</h1>
        <Link href="/staff/id-tags/setup" className="ml-auto rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-900">Office setup</Link>
      </div>
      <p className="mt-1 text-sm text-slate-500">Everyone across all offices. Open a person to run their Entuitive setup, upload the card and set the expiry.</p>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {tiles.map((t) => (
          <div key={t.label} className={`${card} px-4 py-3`}>
            <div className={`text-2xl font-extrabold ${t.color}`}>{t.n}</div>
            <div className="mt-0.5 text-xs text-slate-500">{t.label}</div>
          </div>
        ))}
      </div>

      <form method="get" className="mt-5 flex flex-wrap items-center gap-2">
        <input name="q" defaultValue={q} placeholder="Search name, email, phone or badge #"
          className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <select name="dealerId" defaultValue={dealerFilter || ''} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">All offices</option>
          {dealers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select name="status" defaultValue={statusFilter || ''} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">All statuses</option>
          {STATUS_KEYS.map((s) => <option key={s} value={s}>{ID_TAG_STATUS_LABEL[s]}</option>)}
        </select>
        <button type="submit" className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700">Search</button>
        {(q || statusFilter || dealerFilter) && <Link href="/staff/id-tags" className="px-2 py-2 text-sm text-slate-500 hover:text-slate-800">Clear</Link>}
      </form>

      <div className={`${card} mt-4 overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5 font-semibold">Person</th>
                <th className="px-4 py-2.5 font-semibold">Office</th>
                <th className="px-4 py-2.5 font-semibold">Training</th>
                <th className="px-4 py-2.5 font-semibold">Headshot</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">Expiry</th>
                <th className="px-4 py-2.5 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">No one matches this search.</td></tr>
              )}
              {rows.map((r) => {
                const d = daysUntil(r.validUntil);
                return (
                  <tr key={r.id} className="border-t border-slate-100 align-middle">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{r.personName}</div>
                      {r.personEmail && <div className="text-xs text-slate-400">{r.personEmail}</div>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{r.dealerName || '—'}</td>
                    <td className="px-4 py-3">
                      {r.certified
                        ? <span className="text-xs font-bold text-green-700">✓</span>
                        : <span className="text-xs font-bold text-red-600">✗</span>}
                    </td>
                    <td className="px-4 py-3">
                      {r.hasHeadshot
                        ? <span className="text-xs font-bold text-green-700">✓</span>
                        : <span className="text-xs font-bold text-amber-600">Missing</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE_CLASS[ID_TAG_STATUS_TONE[r.status]]}`}>
                        {ID_TAG_STATUS_LABEL[r.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {r.validUntil
                        ? <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE_CLASS[expiryTone(d)]}`}>{expiryLabel(d)}</span>
                        : <span className="text-xs text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/staff/id-tags/${r.id}`} className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700">Open</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
