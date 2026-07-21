import { requireRole } from '@/lib/session';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 100;

export default async function AuditPage({ searchParams }: { searchParams: { page?: string } }) {
  await requireRole('ADMIN');
  const page = Math.max(1, parseInt(searchParams.page || '1', 10) || 1);
  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      include: { actor: true },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Audit log</h1>
        <span className="text-sm text-gray-500">{total} entries</span>
      </div>
      <div className="card overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2">When</th>
              <th className="px-4 py-2">Actor</th>
              <th className="px-4 py-2">Action</th>
              <th className="px-4 py-2">Entity</th>
              <th className="px-4 py-2">Detail</th>
              <th className="px-4 py-2">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="whitespace-nowrap px-4 py-2 text-gray-500">{l.createdAt.toLocaleString('en-CA')}</td>
                <td className="px-4 py-2">{l.actor?.name ?? l.actorId ?? 'system'}</td>
                <td className="px-4 py-2 font-mono text-xs">{l.action}</td>
                <td className="px-4 py-2 text-gray-500">{l.entityType}{l.entityId ? `:${l.entityId.slice(0, 8)}` : ''}</td>
                <td className="px-4 py-2 text-gray-500">{l.detail}</td>
                <td className="px-4 py-2 text-gray-400">{l.ipAddress ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm">
        <a
          href={`/admin/audit?page=${page - 1}`}
          className={`btn-secondary ${page <= 1 ? 'pointer-events-none opacity-40' : ''}`}
        >
          Previous
        </a>
        <span className="text-gray-500">Page {page} of {totalPages}</span>
        <a
          href={`/admin/audit?page=${page + 1}`}
          className={`btn-secondary ${page >= totalPages ? 'pointer-events-none opacity-40' : ''}`}
        >
          Next
        </a>
      </div>
    </div>
  );
}
