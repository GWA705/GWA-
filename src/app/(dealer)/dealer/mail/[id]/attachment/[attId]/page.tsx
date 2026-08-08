import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireDealerAccess } from '@/lib/session';
import { prisma } from '@/lib/db';
import { mailWhereForDealer } from '@/lib/inbox';
import { friendlyFileName } from '@/lib/filenames';

export const dynamic = 'force-dynamic';

// In-portal attachment viewer. Opening the raw file directly (target="_blank")
// leaves mobile/standalone users with no way back to the portal, so we embed
// the file inside a portal page that always has a Back button.
export default async function DealerAttachmentViewer({
  params,
}: {
  params: { id: string; attId: string };
}) {
  const session = await requireDealerAccess();
  if (!session.dealerId) notFound();

  const mail = await prisma.mail.findFirst({
    where: { id: params.id, ...mailWhereForDealer(session.dealerId, session.isDistributor) },
    select: { id: true, subject: true, attachments: { where: { id: params.attId }, select: { id: true, fileName: true, mimeType: true } } },
  });
  const att = mail?.attachments[0];
  if (!mail || !att) notFound();

  const src = `/api/mail/attachments/${att.id}`;
  const isPdf = att.mimeType === 'application/pdf';
  const isImage = att.mimeType.startsWith('image/');
  const name = friendlyFileName(att.fileName);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/dealer/mail/${mail.id}`} className="text-sm text-gray-500 hover:underline">
          ← Back to message
        </Link>
        <a href={`${src}?download=1`} className="btn-secondary text-xs">Download</a>
      </div>

      <h1 className="truncate text-lg font-semibold text-gray-900" title={att.fileName}>{name}</h1>

      <div className="card overflow-hidden p-0">
        {isImage ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={src} alt={name} className="mx-auto max-h-[80vh] w-full object-contain bg-gray-50" />
        ) : isPdf ? (
          <object data={src} type="application/pdf" className="h-[80vh] w-full">
            <div className="p-6 text-center text-sm text-gray-600">
              Your browser can&apos;t preview this PDF here.{' '}
              <a href={src} target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline">Open it</a>{' '}
              or <a href={`${src}?download=1`} className="text-brand-700 hover:underline">download it</a>.
            </div>
          </object>
        ) : (
          <div className="p-6 text-center text-sm text-gray-600">
            This file type can&apos;t be previewed.{' '}
            <a href={`${src}?download=1`} className="text-brand-700 hover:underline">Download it</a> to view.
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400">Opening or downloading a file is recorded for compliance.</p>
    </div>
  );
}
