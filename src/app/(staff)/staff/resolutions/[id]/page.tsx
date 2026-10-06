import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { prisma } from '@/lib/db';
import { loadResolutionCase } from '@/lib/resolutionCases';
import { STATUS_LABEL, statusChipClass } from '@/lib/resolutionStatus';
import { formatPhoneDisplay } from '@/lib/format';
import { DocViewer } from '@/components/DocViewer';
import { CaseControls } from '../CaseControls';

export const dynamic = 'force-dynamic';

export default async function CaseDetailPage({ params }: { params: { id: string } }) {
  await requireRole('REVIEWER', 'ADMIN');
  const c = await loadResolutionCase(params.id);
  if (!c) notFound();

  const staff = await prisma.user.findMany({
    where: { role: { in: ['REVIEWER', 'ADMIN'] }, active: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });

  return (
    <div className="max-w-3xl space-y-5">
      <Link href="/staff/resolutions" className="text-sm text-gray-500 hover:underline">← Back to the queue</Link>

      {/* Header */}
      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">
              {c.caseNumber} · opened {c.openedAt} · by {c.openedBy}
            </div>
            <h1 className="mt-1 text-xl font-semibold text-gray-900 dark:text-slate-100">{c.title}</h1>
            <div className="mt-1 text-sm text-gray-600 dark:text-slate-300">
              👤 {c.applicationId ? (
                <Link href={`/staff/find-customer/${c.applicationId}`} className="font-medium text-brand-700 hover:underline dark:text-sky-300">{c.customerName}</Link>
              ) : c.customerName}
              {c.customerPhone && <> · 📱 {formatPhoneDisplay(c.customerPhone)}</>}
              {' · '}🏬 {c.officeName}
              {c.hdReference && <> · HD #{c.hdReference}</>}
            </div>
          </div>
          <div className="text-right">
            <span className={statusChipClass(c.status)}>{STATUS_LABEL[c.status]}</span>
            {c.age === 'red' && <div className="mt-1 text-xs font-semibold text-red-600">● aging ({'>'}7 days)</div>}
            {c.age === 'amber' && <div className="mt-1 text-xs font-semibold text-amber-600">● ageing ({'>'}3 days)</div>}
            {c.priority === 'high' && <div className="mt-1 text-xs font-semibold text-red-700">High priority</div>}
          </div>
        </div>
      </div>

      {/* Problem */}
      <div className="card p-5">
        <h2 className="mb-1 text-sm font-semibold text-gray-900 dark:text-slate-100">Problem</h2>
        <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-slate-200">{c.description}</p>
      </div>

      {/* Documents & resources (from the linked deal) */}
      <div className="card p-5">
        <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-slate-100">Documents &amp; resources</h2>
        {!c.applicationId ? (
          <p className="text-sm text-gray-500 dark:text-slate-400">Link this case to the customer&apos;s deal to pull in its documents.</p>
        ) : c.dealDocs.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-slate-400">No documents on the linked deal yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {c.dealDocs.map((d) => (
              <DocViewer
                key={d.id}
                id={d.id}
                fileName={d.label}
                mimeType={d.mime}
                title={d.label}
                className="rounded-md bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100 dark:bg-sky-900/30 dark:text-sky-300"
              >
                📄 {d.label} ↗
              </DocViewer>
            ))}
          </div>
        )}
      </div>

      {/* Controls: status, assign, notify office, add note */}
      <CaseControls
        caseId={c.id}
        status={c.status}
        assignedToId={c.assignedToId}
        staff={staff}
        canNotifyOffice={!!c.applicationId}
        officeName={c.officeName}
      />

      {/* Activity */}
      <div className="card p-5">
        <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-slate-100">Activity</h2>
        {c.notes.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-slate-500">No activity yet.</p>
        ) : (
          <ul className="space-y-3">
            {c.notes.map((n) => (
              <li key={n.id} className="border-l-2 border-gray-200 pl-3 dark:border-slate-700">
                <div className="text-xs text-gray-400 dark:text-slate-500">{n.at} · {n.author}</div>
                <div className="text-sm text-gray-800 dark:text-slate-100">
                  {n.statusTo ? (
                    <span className="font-medium">→ {STATUS_LABEL[n.statusTo]}</span>
                  ) : n.body}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
