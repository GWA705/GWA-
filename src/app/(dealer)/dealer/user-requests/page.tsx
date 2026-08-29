import { PageHeader } from '@/components/PageHeader';
import { requireDealerAccess } from '@/lib/session';
import { prisma } from '@/lib/db';
import { UserRequestForm } from './UserRequestForm';

export const dynamic = 'force-dynamic';

const ITEM_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  CREATED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-gray-100 text-gray-600',
};
const ITEM_LABEL: Record<string, string> = {
  PENDING: 'Awaiting GWA',
  CREATED: 'Login created',
  REJECTED: 'Declined',
};

export default async function DealerUserRequestsPage() {
  const user = await requireDealerAccess();
  const requests = user.dealerId
    ? await prisma.userRequest.findMany({
        where: { dealerId: user.dealerId },
        orderBy: { createdAt: 'desc' },
        include: { items: { orderBy: { createdAt: 'asc' } }, submittedBy: { select: { name: true } } },
        take: 20,
      })
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="My office"
        title="Request portal logins"
        subtitle="List the people at your office who need a login. GWA reviews each request and sets up the accounts — new users get an email to choose their password and turn on two-factor sign-in."
      />

      <section className="card p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">New request</h2>
        <UserRequestForm />
      </section>

      {requests.length > 0 && (
        <section className="card p-6">
          <h2 className="mb-4 text-base font-semibold text-gray-900">Your past requests</h2>
          <ul className="space-y-4">
            {requests.map((req) => (
              <li key={req.id} className="rounded-lg border border-gray-200 p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                  <span>
                    Sent {req.createdAt.toLocaleDateString('en-CA')} by {req.submittedBy.name}
                  </span>
                  <span>{req.items.length} {req.items.length === 1 ? 'person' : 'people'}</span>
                </div>
                <ul className="divide-y divide-gray-100">
                  {req.items.map((it) => (
                    <li key={it.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                      <span className="min-w-0">
                        <span className="font-medium text-gray-800">{it.name}</span>
                        <span className="ml-2 break-all text-gray-500">{it.email}</span>
                        {it.isMainContact && <span className="ml-2 text-xs text-brand-700">· main contact</span>}
                      </span>
                      <span className="flex items-center gap-2">
                        {it.status === 'REJECTED' && it.rejectReason && (
                          <span className="text-xs text-gray-400">{it.rejectReason}</span>
                        )}
                        <span className={`badge ${ITEM_BADGE[it.status]}`}>{ITEM_LABEL[it.status]}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                {req.note && <p className="mt-2 text-xs text-gray-500">Note: {req.note}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
