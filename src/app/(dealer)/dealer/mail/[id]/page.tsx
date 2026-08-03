import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireDealerAccess } from '@/lib/session';
import { prisma } from '@/lib/db';
import { mailWhereForDealer } from '@/lib/inbox';
import { friendlyFileName } from '@/lib/filenames';
import { acknowledgeMailAction } from '../actions';

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
    where: { id: params.id, ...mailWhereForDealer(session.dealerId) },
    include: { sender: { select: { name: true } }, attachments: { orderBy: { createdAt: 'asc' } } },
  });
  if (!mail) notFound();

  // Record that this user opened the mail (keeps the first-open timestamp).
  await prisma.mailReceipt.upsert({
    where: { mailId_userId: { mailId: mail.id, userId: session.userId } },
    create: { mailId: mail.id, userId: session.userId },
    update: {},
  });
  const receipt = await prisma.mailReceipt.findUnique({
    where: { mailId_userId: { mailId: mail.id, userId: session.userId } },
    select: { acknowledgedAt: true },
  });
  const acknowledged = !!receipt?.acknowledgedAt;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dealer/mail" className="text-sm text-gray-500 hover:underline">← Back to Mail</Link>
        <h1 className="mt-2 text-xl font-semibold text-gray-900">{mail.subject}</h1>
        <p className="mt-1 text-sm text-gray-500">
          From {mail.sender.name} · {mail.createdAt.toLocaleString('en-CA')}
        </p>
      </div>

      <section className="card p-6">
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">{mail.body}</div>
      </section>

      {mail.attachments.length > 0 && (
        <section className="card p-6">
          <h2 className="mb-3 text-base font-semibold text-gray-900">Attachments</h2>
          <ul className="divide-y divide-gray-100">
            {mail.attachments.map((a, i) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <a
                    href={`/api/mail/attachments/${a.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={a.fileName}
                    className="block truncate font-medium text-brand-700 hover:underline"
                  >
                    📄 {friendlyFileName(a.fileName, i)}
                  </a>
                  <div className="text-xs text-gray-400">{fmtSize(a.sizeBytes)}</div>
                </div>
                <a href={`/api/mail/attachments/${a.id}?download=1`} className="btn-secondary shrink-0 text-xs">Download</a>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-gray-400">Opening or downloading a file is recorded for compliance.</p>
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
