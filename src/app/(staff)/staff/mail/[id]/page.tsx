import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const fmt = (d: Date | null | undefined) =>
  d ? d.toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';

export default async function MailReceipts({ params }: { params: { id: string } }) {
  await requireRole('REVIEWER', 'ADMIN');

  const mail = await prisma.mail.findUnique({
    where: { id: params.id },
    include: {
      sender: { select: { name: true } },
      attachments: { orderBy: { createdAt: 'asc' } },
      recipients: { include: { dealer: { select: { id: true, name: true } } } },
    },
  });
  if (!mail) notFound();

  const dealerIds = mail.allDealers
    ? (await prisma.dealer.findMany({ where: { active: true }, select: { id: true } })).map((d) => d.id)
    : mail.recipients.map((r) => r.dealerId);

  const [users, receipts, views] = await Promise.all([
    prisma.user.findMany({
      where: { dealerId: { in: dealerIds }, role: 'DEALER_USER', active: true },
      select: { id: true, name: true, email: true, dealer: { select: { name: true } } },
      orderBy: [{ dealer: { name: 'asc' } }, { name: 'asc' }],
    }),
    prisma.mailReceipt.findMany({ where: { mailId: mail.id }, select: { userId: true, openedAt: true, acknowledgedAt: true } }),
    prisma.mailAttachmentView.findMany({
      where: { attachmentId: { in: mail.attachments.map((a) => a.id) } },
      select: { attachmentId: true, userId: true, viewCount: true },
    }),
  ]);

  const receiptByUser = new Map(receipts.map((r) => [r.userId, r]));
  const viewedByUser = new Map<string, Set<string>>();
  for (const v of views) {
    if (!viewedByUser.has(v.userId)) viewedByUser.set(v.userId, new Set());
    viewedByUser.get(v.userId)!.add(v.attachmentId);
  }
  const viewersByAttachment = new Map<string, number>();
  for (const v of views) viewersByAttachment.set(v.attachmentId, (viewersByAttachment.get(v.attachmentId) ?? 0) + 1);

  const openedCount = users.filter((u) => receiptByUser.get(u.id)?.openedAt).length;
  const ackCount = users.filter((u) => receiptByUser.get(u.id)?.acknowledgedAt).length;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/staff/mail" className="text-sm text-gray-500 hover:underline">← Back to Mail</Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-gray-900">{mail.subject}</h1>
          {mail.requireAck && <span className="badge bg-amber-100 text-amber-800">Acknowledgement required</span>}
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Sent by {mail.sender.name} · {mail.createdAt.toLocaleString('en-CA')} ·{' '}
          {mail.allDealers ? 'All dealers' : `${mail.recipients.length} dealer(s)`}
        </p>
        {!mail.allDealers && mail.recipients.length > 0 && (
          <p className="mt-1 text-xs text-gray-400">{mail.recipients.map((r) => r.dealer.name).join(', ')}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="card p-4"><div className="text-2xl font-bold tabular-nums text-gray-900">{users.length}</div><div className="text-xs text-gray-500">Recipients</div></div>
        <div className="card p-4"><div className="text-2xl font-bold tabular-nums text-gray-900">{openedCount}</div><div className="text-xs text-gray-500">Opened</div></div>
        {mail.requireAck && <div className="card p-4"><div className="text-2xl font-bold tabular-nums text-gray-900">{ackCount}</div><div className="text-xs text-gray-500">Acknowledged</div></div>}
        <div className="card p-4"><div className="text-2xl font-bold tabular-nums text-gray-900">{mail.attachments.length}</div><div className="text-xs text-gray-500">Attachments</div></div>
      </div>

      <section className="card p-6">
        <h2 className="mb-1 text-base font-semibold text-gray-900">Message</h2>
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{mail.body}</div>
        {mail.attachments.length > 0 && (
          <ul className="mt-4 divide-y divide-gray-100 border-t border-gray-100">
            {mail.attachments.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <a href={`/api/mail/attachments/${a.id}`} target="_blank" rel="noopener noreferrer" className="truncate font-medium text-brand-700 hover:underline">📄 {a.fileName}</a>
                <span className="shrink-0 text-xs text-gray-500">{viewersByAttachment.get(a.id) ?? 0} viewer(s)</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Person</th>
              <th className="px-4 py-3">Dealer</th>
              <th className="px-4 py-3">Opened</th>
              {mail.requireAck && <th className="px-4 py-3">Acknowledged</th>}
              {mail.attachments.length > 0 && <th className="px-4 py-3">Files viewed</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => {
              const r = receiptByUser.get(u.id);
              const viewed = viewedByUser.get(u.id)?.size ?? 0;
              return (
                <tr key={u.id} className={r?.openedAt ? '' : 'bg-amber-50/40'}>
                  <td className="px-4 py-3"><div className="font-medium text-gray-800">{u.name}</div><div className="text-xs text-gray-400">{u.email}</div></td>
                  <td className="px-4 py-3 text-gray-600">{u.dealer?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{r?.openedAt ? fmt(r.openedAt) : <span className="text-amber-700">Not yet</span>}</td>
                  {mail.requireAck && <td className="px-4 py-3 text-gray-600">{r?.acknowledgedAt ? <span className="text-green-700">{fmt(r.acknowledgedAt)}</span> : <span className="text-gray-400">—</span>}</td>}
                  {mail.attachments.length > 0 && <td className="px-4 py-3 tabular-nums text-gray-600">{viewed}/{mail.attachments.length}</td>}
                </tr>
              );
            })}
            {users.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-400">No dealer users to show.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
