import { PageHeader } from '@/components/PageHeader';
import Link from 'next/link';
import { requireDealerAccess } from '@/lib/session';
import { prisma } from '@/lib/db';
import { mailWhereForDealer } from '@/lib/inbox';

export const dynamic = 'force-dynamic';

export default async function DealerMailbox() {
  const session = await requireDealerAccess();
  const mails = session.dealerId
    ? await prisma.mail.findMany({
        where: mailWhereForDealer(session.userId, session.dealerId, session.isDistributor),
        orderBy: { createdAt: 'desc' },
        include: {
          sender: { select: { name: true } },
          attachments: { select: { id: true } },
          // senderLabel is a scalar and comes back automatically; sender.name is
          // the fallback for older messages.
          receipts: { where: { userId: session.userId }, select: { openedAt: true, acknowledgedAt: true } },
        },
      })
    : [];

  return (
    <div>
      <div className="mb-5">
        <PageHeader eyebrow="Messages" title="Mail" subtitle="Messages and files from the GWA team." />
      </div>

      {mails.length === 0 ? (
        <div className="card p-8 text-center text-sm text-gray-500">No mail yet.</div>
      ) : (
        <div className="card divide-y divide-gray-100">
          {mails.map((m) => {
            const unread = m.receipts.length === 0;
            const needsAck = m.requireAck && !m.receipts[0]?.acknowledgedAt;
            return (
              <Link key={m.id} href={`/dealer/mail/${m.id}`} className="flex items-start gap-3 p-4 hover:bg-gray-50">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${unread ? 'bg-red-500' : 'bg-transparent'}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`truncate ${unread ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>{m.subject}</span>
                    {needsAck && <span className="badge bg-amber-100 text-amber-800">Acknowledgement required</span>}
                    {m.attachments.length > 0 && (
                      <span className="badge bg-gray-100 text-gray-600">📎 {m.attachments.length}</span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-gray-500">
                    From {m.senderLabel || m.sender.name} · {m.createdAt.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
