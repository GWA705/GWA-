import Link from 'next/link';
import { prisma } from '@/lib/db';
import { canAdminSection } from '@/lib/rbac';
import type { SessionUser } from '@/lib/session';

// A prominent "needs attention now" panel for the admin overview: only the
// things a person should act on today, each gated to the sections they can see,
// and hidden entirely when everything is clear.
export async function AdminAttention({ user }: { user: SessionUser }) {
  const canRequests = canAdminSection(user, 'user-requests');
  const canQueue = canAdminSection(user, 'review-queue') || user.role === 'REVIEWER';

  const [pendingRequests, problems, awaitingReview, signedDocs] = await Promise.all([
    canRequests ? prisma.userRequest.count({ where: { status: 'PENDING' } }) : Promise.resolve(0),
    canQueue ? prisma.application.count({ where: { status: 'PROBLEM' } }) : Promise.resolve(0),
    canQueue ? prisma.application.count({ where: { status: 'SUBMITTED' } }) : Promise.resolve(0),
    canQueue ? prisma.application.count({ where: { status: 'FUNDING_SUBMITTED' } }) : Promise.resolve(0),
  ]);

  const items: { label: string; count: number; href: string; tone: string }[] = [];
  if (pendingRequests > 0)
    items.push({ label: `${pendingRequests} login request${pendingRequests === 1 ? '' : 's'} to approve`, count: pendingRequests, href: '/admin/user-requests', tone: 'text-amber-800 bg-amber-100' });
  if (problems > 0)
    items.push({ label: `${problems} deal${problems === 1 ? '' : 's'} flagged with a problem`, count: problems, href: '/staff', tone: 'text-red-800 bg-red-100' });
  if (awaitingReview > 0)
    items.push({ label: `${awaitingReview} new deal${awaitingReview === 1 ? '' : 's'} awaiting first review`, count: awaitingReview, href: '/staff', tone: 'text-blue-800 bg-blue-100' });
  if (signedDocs > 0)
    items.push({ label: `${signedDocs} signed package${signedDocs === 1 ? '' : 's'} to review`, count: signedDocs, href: '/staff', tone: 'text-indigo-800 bg-indigo-100' });

  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-center gap-2">
        <span className="text-lg">🔔</span>
        <h2 className="text-sm font-semibold text-amber-900">Needs your attention</h2>
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <li key={it.href + it.label}>
            <Link
              href={it.href}
              className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm transition hover:border-amber-300 hover:shadow-sm"
            >
              <span className="text-gray-800">{it.label}</span>
              <span className={`badge shrink-0 ${it.tone}`}>{it.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
