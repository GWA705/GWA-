import { requireRole } from '@/lib/session';
import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 100;

interface AuditSearch {
  page?: string;
  q?: string;
  actorId?: string;
  action?: string;
  dealerId?: string;
  from?: string;
  to?: string;
  sort?: string;
}

export default async function AuditPage({ searchParams }: { searchParams: AuditSearch }) {
  await requireRole('ADMIN');

  const page = Math.max(1, parseInt(searchParams.page || '1', 10) || 1);
  const q = (searchParams.q || '').trim();
  const actorId = searchParams.actorId || '';
  const action = searchParams.action || '';
  const dealerId = searchParams.dealerId || '';
  const from = searchParams.from || '';
  const to = searchParams.to || '';
  const sort = searchParams.sort === 'asc' ? 'asc' : 'desc';

  // Filter option lists.
  const [users, dealers, actionGroups] = await Promise.all([
    prisma.user.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, role: true } }),
    prisma.dealer.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.auditLog.groupBy({ by: ['action'], orderBy: { action: 'asc' } }),
  ]);

  // Build the where clause from the active filters.
  const and: Prisma.AuditLogWhereInput[] = [];
  if (actorId) and.push({ actorId });
  if (action) and.push({ action });
  if (from) and.push({ createdAt: { gte: new Date(`${from}T00:00:00`) } });
  if (to) and.push({ createdAt: { lte: new Date(`${to}T23:59:59.999`) } });
  if (q) {
    and.push({
      OR: [
        { detail: { contains: q, mode: 'insensitive' } },
        { action: { contains: q, mode: 'insensitive' } },
        { entityType: { contains: q, mode: 'insensitive' } },
        { entityId: { contains: q } },
      ],
    });
  }
  if (dealerId) {
    // "By dealer" = activity on that dealer's deals (applications + their
    // documents) plus actions taken by that dealer's own users.
    const apps = await prisma.application.findMany({ where: { dealerId }, select: { id: true } });
    const appIds = apps.map((a) => a.id);
    const docs = appIds.length
      ? await prisma.document.findMany({ where: { applicationId: { in: appIds } }, select: { id: true } })
      : [];
    const dealerUserIds = (
      await prisma.user.findMany({ where: { dealerId }, select: { id: true } })
    ).map((u) => u.id);
    const entityIds = [...appIds, ...docs.map((d) => d.id)];
    and.push({
      OR: [
        ...(entityIds.length ? [{ entityId: { in: entityIds } }] : []),
        ...(dealerUserIds.length ? [{ actorId: { in: dealerUserIds } }] : []),
        // If a dealer has no activity yet, match nothing rather than everything.
        ...(entityIds.length || dealerUserIds.length ? [] : [{ id: '__none__' }]),
      ],
    });
  }
  const where: Prisma.AuditLogWhereInput = and.length ? { AND: and } : {};

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: sort },
      include: { actor: true },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const hasFilters = !!(q || actorId || action || dealerId || from || to || sort === 'asc');

  // Preserve the active filters in the pagination / drill-down links.
  const qs = (over: Partial<AuditSearch>) => {
    const params = new URLSearchParams();
    const merged = { q, actorId, action, dealerId, from, to, sort, ...over };
    for (const [k, v] of Object.entries(merged)) {
      if (v && !(k === 'sort' && v === 'desc')) params.set(k, String(v));
    }
    const s = params.toString();
    return `/admin/audit${s ? `?${s}` : ''}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Audit log</h1>
        <span className="text-sm text-gray-500">
          {total} {total === 1 ? 'entry' : 'entries'}{hasFilters ? ' (filtered)' : ''}
        </span>
      </div>

      {/* Filters — a plain GET form so filtering works without client JS. */}
      <form method="GET" action="/admin/audit" className="card space-y-3 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="label text-xs" htmlFor="q">Search</label>
            <input id="q" name="q" defaultValue={q} placeholder="Detail, action, ID…" className="input" />
          </div>
          <div>
            <label className="label text-xs" htmlFor="actorId">User (actor)</label>
            <select id="actorId" name="actorId" defaultValue={actorId} className="input">
              <option value="">All users</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label text-xs" htmlFor="dealerId">Dealer</label>
            <select id="dealerId" name="dealerId" defaultValue={dealerId} className="input">
              <option value="">All dealers</option>
              {dealers.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label text-xs" htmlFor="action">Action</label>
            <select id="action" name="action" defaultValue={action} className="input">
              <option value="">All actions</option>
              {actionGroups.map((a) => (
                <option key={a.action} value={a.action}>{a.action}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label text-xs" htmlFor="from">From date</label>
            <input id="from" name="from" type="date" defaultValue={from} className="input" />
          </div>
          <div>
            <label className="label text-xs" htmlFor="to">To date</label>
            <input id="to" name="to" type="date" defaultValue={to} className="input" />
          </div>
          <div>
            <label className="label text-xs" htmlFor="sort">Order</label>
            <select id="sort" name="sort" defaultValue={sort} className="input">
              <option value="desc">Newest first</option>
              <option value="asc">Oldest first</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="submit" className="btn-primary text-sm">Apply filters</button>
          {hasFilters && <a href="/admin/audit" className="btn-secondary text-sm">Clear</a>}
        </div>
      </form>

      <div className="card overflow-x-auto">
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
            {logs.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">No matching entries.</td></tr>
            ) : (
              logs.map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap px-4 py-2 text-gray-500">{l.createdAt.toLocaleString('en-CA')}</td>
                  <td className="px-4 py-2">
                    {l.actorId ? (
                      <a href={qs({ actorId: l.actorId, page: '1' })} className="text-brand-700 hover:underline">
                        {l.actor?.name ?? l.actorName ?? l.actorId}
                      </a>
                    ) : (
                      l.actorName ?? 'system'
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <a href={qs({ action: l.action, page: '1' })} className="font-mono text-xs text-brand-700 hover:underline">
                      {l.action}
                    </a>
                  </td>
                  <td className="px-4 py-2 text-gray-500">{l.entityType}{l.entityId ? `:${l.entityId.slice(0, 8)}` : ''}</td>
                  <td className="px-4 py-2 text-gray-500">{l.detail}</td>
                  <td className="px-4 py-2 text-gray-400">{l.ipAddress ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <a
          href={qs({ page: String(page - 1) })}
          className={`btn-secondary ${page <= 1 ? 'pointer-events-none opacity-40' : ''}`}
        >
          Previous
        </a>
        <span className="text-gray-500">Page {page} of {totalPages}</span>
        <a
          href={qs({ page: String(page + 1) })}
          className={`btn-secondary ${page >= totalPages ? 'pointer-events-none opacity-40' : ''}`}
        >
          Next
        </a>
      </div>
    </div>
  );
}
