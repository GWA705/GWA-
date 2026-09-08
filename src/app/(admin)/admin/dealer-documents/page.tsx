import Link from 'next/link';
import { requireAdminSection } from '@/lib/session';
import { prisma } from '@/lib/db';
import { BUSINESS_DOC_TYPES, OTHER_DOC_TYPE } from '@/lib/constants';
import { docStatus, statusLabel, type DocStatus } from '@/lib/dealerDocs';

export const dynamic = 'force-dynamic';

const CHIP: Record<DocStatus, string> = {
  valid: 'bg-green-100 text-green-800',
  expiring: 'bg-amber-100 text-amber-800',
  expired: 'bg-red-100 text-red-700',
  missing: 'bg-gray-100 text-gray-500',
};

const iso = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : null);

export default async function AdminDealerDocumentsPage() {
  await requireAdminSection('dealer-documents');

  const dealers = await prisma.dealer.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
    include: { businessDocuments: { orderBy: { createdAt: 'desc' } } },
  });

  const now = new Date();
  type Row = {
    id: string;
    name: string;
    cells: { type: string; label: string; status: DocStatus; text: string; docId: string | null; expiry: string | null }[];
    otherCount: number;
    worst: number; // 3 expired, 2 missing, 1 expiring, 0 ok
  };

  const rank: Record<DocStatus, number> = { expired: 3, missing: 2, expiring: 1, valid: 0 };

  const rows: Row[] = dealers.map((d) => {
    let worst = 0;
    const cells = BUSINESS_DOC_TYPES.map((t) => {
      const doc = d.businessDocuments.find((x) => x.type === t.key) ?? null;
      const { status, daysLeft } = docStatus(doc?.expiryDate ?? null, now);
      worst = Math.max(worst, rank[status]);
      return { type: t.key, label: t.label, status, text: statusLabel(status, daysLeft), docId: doc?.id ?? null, expiry: iso(doc?.expiryDate ?? null) };
    });
    const otherCount = d.businessDocuments.filter((x) => x.type === OTHER_DOC_TYPE).length;
    return { id: d.id, name: d.name, cells, otherCount, worst };
  });

  // Needs-attention first (expired, then missing, then expiring), else by name.
  rows.sort((a, b) => b.worst - a.worst || a.name.localeCompare(b.name));

  const totals = rows.reduce(
    (acc, r) => {
      for (const c of r.cells) acc[c.status] += 1;
      return acc;
    },
    { valid: 0, expiring: 0, expired: 0, missing: 0 } as Record<DocStatus, number>,
  );

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Dealer documents</h1>
        <p className="mt-1 text-sm text-gray-500">
          Compliance status for every active office. Dealers upload their WSIB / WCB clearance and
          other documents in the portal; the system reads the expiry date and reminds them before it
          lapses, so you no longer have to chase paperwork.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <SummaryTile label="Expired" n={totals.expired} className="bg-red-50 text-red-700" />
        <SummaryTile label="Not uploaded" n={totals.missing} className="bg-gray-50 text-gray-600" />
        <SummaryTile label="Expiring soon" n={totals.expiring} className="bg-amber-50 text-amber-800" />
        <SummaryTile label="Current" n={totals.valid} className="bg-green-50 text-green-700" />
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3">Office</th>
              {BUSINESS_DOC_TYPES.map((t) => (
                <th key={t.key} className="px-4 py-3">{t.key}</th>
              ))}
              <th className="px-4 py-3">Other</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.id} className="align-top">
                <td className="px-4 py-3 font-medium text-gray-900">{r.name}</td>
                {r.cells.map((c) => (
                  <td key={c.type} className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${CHIP[c.status]}`}>{c.text}</span>
                    {c.docId && (
                      <div className="mt-1">
                        <Link href={`/api/dealer/documents/${c.docId}/file`} target="_blank" className="text-xs text-brand-700 hover:underline">View</Link>
                      </div>
                    )}
                  </td>
                ))}
                <td className="px-4 py-3 text-xs text-gray-500">{r.otherCount || '—'}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={BUSINESS_DOC_TYPES.length + 2} className="px-4 py-8 text-center text-gray-500">No active dealers.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryTile({ label, n, className }: { label: string; n: number; className: string }) {
  return (
    <div className={`rounded-xl px-4 py-3 ${className}`}>
      <div className="text-2xl font-bold tabular-nums">{n}</div>
      <div className="text-xs font-medium">{label}</div>
    </div>
  );
}
