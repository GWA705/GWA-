import { requireAdminSection } from '@/lib/session';
import { prisma } from '@/lib/db';
import { ItemActions } from './ItemActions';

export const dynamic = 'force-dynamic';

const ITEM_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  CREATED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-gray-100 text-gray-600',
};
const ITEM_LABEL: Record<string, string> = {
  PENDING: 'Awaiting decision',
  CREATED: 'Login created',
  REJECTED: 'Declined',
};

export default async function AdminUserRequestsPage() {
  await requireAdminSection('user-requests');
  const requests = await prisma.userRequest.findMany({
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    include: {
      dealer: { select: { name: true } },
      submittedBy: { select: { name: true, email: true } },
      items: { orderBy: { createdAt: 'asc' } },
    },
    take: 100,
  });

  const pending = requests.filter((r) => r.status === 'PENDING');
  const done = requests.filter((r) => r.status !== 'PENDING');
  const pendingPeople = pending.reduce((n, r) => n + r.items.filter((i) => i.status === 'PENDING').length, 0);

  function Card({ req }: { req: (typeof requests)[number] }) {
    return (
      <li className="card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-gray-900">{req.dealer.name}</h3>
            <p className="text-xs text-gray-500">
              Requested {req.createdAt.toLocaleString('en-CA')} by {req.submittedBy.name} ({req.submittedBy.email})
            </p>
          </div>
          <span className="text-xs text-gray-400">{req.items.length} {req.items.length === 1 ? 'person' : 'people'}</span>
        </div>
        {req.note && <p className="mb-3 rounded bg-gray-50 p-2 text-xs text-gray-600">Note: {req.note}</p>}
        <ul className="divide-y divide-gray-100">
          {req.items.map((it) => (
            <li key={it.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-gray-900">{it.name}</span>
                  {it.isMainContact && <span className="badge bg-brand-50 text-brand-700">Owner / main contact</span>}
                </div>
                <div className="mt-0.5 break-all text-sm text-gray-600">{it.email}</div>
                <div className="text-xs text-gray-400">
                  {it.phone ? `${it.phone} · ` : ''}{it.jobTitle || 'No job title'}
                </div>
              </div>
              <div className="flex-none">
                {it.status === 'PENDING' ? (
                  <ItemActions itemId={it.id} email={it.email} />
                ) : (
                  <div className="text-right">
                    <span className={`badge ${ITEM_BADGE[it.status]}`}>{ITEM_LABEL[it.status]}</span>
                    {it.status === 'REJECTED' && it.rejectReason && (
                      <div className="mt-1 text-xs text-gray-400">{it.rejectReason}</div>
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </li>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">User requests</h1>
        <p className="mt-1 text-sm text-gray-500">
          Logins dealers have asked GWA to create. Approving a person creates their dealer login
          (temporary password, must change at first sign-in) on the requesting dealership.
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-800">
          Waiting on you {pendingPeople > 0 && <span className="ml-1 rounded-full bg-brand-600 px-2 py-0.5 text-xs text-white">{pendingPeople}</span>}
        </h2>
        {pending.length === 0 ? (
          <div className="card p-8 text-center text-sm text-gray-500">No pending requests. 🎉</div>
        ) : (
          <ul className="space-y-4">
            {pending.map((req) => <Card key={req.id} req={req} />)}
          </ul>
        )}
      </section>

      {done.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Handled</h2>
          <ul className="space-y-4">
            {done.map((req) => <Card key={req.id} req={req} />)}
          </ul>
        </section>
      )}
    </div>
  );
}
