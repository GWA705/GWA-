import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireDealerAccess } from '@/lib/session';
import { prisma } from '@/lib/db';
import { mailWhereForDealer } from '@/lib/inbox';
import { friendlyFileName } from '@/lib/filenames';
import { acknowledgeMailAction } from '../actions';
import { DealerReplyForm } from './DealerReplyForm';

export const dynamic = 'force-dynamic';

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default async function DealerMailItem({ params }: { params: { id: string } }) {
  const session = await requireDealerAccess();
  if (!session.dealerId) notFound();

  const mail = await prisma.mail.findFirst({
    where: { id: params.id, ...mailWhereForDealer(session.userId, session.dealerId, session.isDistributor) },
    include: { sender: { select: { name: true } }, attachments: { orderBy: { createdAt: 'asc' } } },
  });
  if (!mail) notFound();

  // Record that this user opened the mail (keeps the first-open timestamp), and
  // use the upsert's own return value instead of a second read-back round trip.
  const receipt = await prisma.mailReceipt.upsert({
    where: { mailId_userId: { mailId: mail.id, userId: session.userId } },
    create: { mailId: mail.id, userId: session.userId },
    update: {},
    select: { acknowledgedAt: true },
  });
  const acknowledged = !!receipt?.acknowledgedAt;

  // The reply thread for this dealer (only when the message allows replies).
  const replies = mail.allowReplies
    ? await prisma.mailReply.findMany({
        where: { mailId: mail.id, dealerId: session.dealerId },
        orderBy: { createdAt: 'asc' },
        include: { author: { select: { name: true } } },
      })
    : [];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dealer/mail" className="text-sm text-gray-500 hover:underline">← Back to Mail</Link>
        <h1 className="mt-2 text-xl font-semibold text-gray-900">{mail.subject}</h1>
        <p className="mt-1 text-sm text-gray-500">
          From {mail.senderLabel || mail.sender.name} · {mail.createdAt.toLocaleString('en-CA')}
        </p>
      </div>

      <section className="card p-6">
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">{mail.body}</div>
      </section>

      {mail.attachments.length > 0 && (
        <section className="card p-6">
          <h2 className="mb-3 text-base font-semibold text-gray-900">Attachments</h2>
          <ul className="divide-y divide-gray-100">
            {mail.attachments.map((a, i) => {
              const viewer = `/dealer/mail/${mail.id}/attachment/${a.id}`;
              const isImage = a.mimeType.startsWith('image/');
              const ext = a.fileName.includes('.') ? a.fileName.slice(a.fileName.lastIndexOf('.') + 1).toUpperCase() : 'FILE';
              return (
                <li key={a.id} className="flex items-center gap-3 py-3">
                  <Link href={viewer} className="shrink-0" title={a.fileName}>
                    {isImage ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={`/api/mail/attachments/${a.id}/thumb`} alt="" className="h-14 w-14 rounded-md object-cover ring-1 ring-gray-200" />
                    ) : (
                      <div className="flex h-14 w-14 flex-col items-center justify-center rounded-md bg-brand-50 ring-1 ring-brand-100">
                        <span className="text-lg leading-none">📄</span>
                        <span className="mt-0.5 text-[10px] font-semibold text-brand-700">{ext}</span>
                      </div>
                    )}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={viewer} title={a.fileName} className="block truncate font-medium text-brand-700 hover:underline">
                      {friendlyFileName(a.fileName, i)}
                    </Link>
                    <div className="text-xs text-gray-400">{fmtSize(a.sizeBytes)}</div>
                  </div>
                  <a href={`/api/mail/attachments/${a.id}?download=1`} className="btn-secondary shrink-0 text-xs">Download</a>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-gray-400">Opening or downloading a file is recorded for compliance.</p>
        </section>
      )}

      {mail.allowReplies && (
        <section className="card p-6">
          <h2 className="mb-3 text-base font-semibold text-gray-900">Reply to GWA</h2>
          {replies.length > 0 && (
            <ul className="mb-4 space-y-3">
              {replies.map((r) => (
                <li
                  key={r.id}
                  className={`rounded-lg p-3 text-sm ${r.fromStaff ? 'bg-brand-50' : 'bg-gray-50'}`}
                >
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs text-gray-500">
                    <span className="font-medium text-gray-700">{r.fromStaff ? 'GWA' : r.author.name}</span>
                    <span>{r.createdAt.toLocaleString('en-CA')}</span>
                  </div>
                  <div className="whitespace-pre-wrap text-gray-800">{r.body}</div>
                </li>
              ))}
            </ul>
          )}
          <DealerReplyForm mailId={mail.id} />
        </section>
      )}

      {mail.requireAck && (
        <section className={`card p-6 ${acknowledged ? '' : 'border-amber-200'}`}>
          {acknowledged ? (
            <p className="text-sm font-medium text-green-700">✓ You have acknowledged reading this message.</p>
          ) : (
            <>
              <h2 className="mb-1 text-base font-semibold text-gray-900">Please confirm you&apos;ve read this</h2>
              <p className="mb-3 text-sm text-gray-600">GWA has asked for confirmation that you&apos;ve read this message.</p>
              <form action={acknowledgeMailAction.bind(null, mail.id)}>
                <button type="submit" className="btn-primary">I have read this</button>
              </form>
            </>
          )}
        </section>
      )}
    </div>
  );
}
