import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaffSection } from '@/lib/session';
import { prisma } from '@/lib/db';
import { friendlyFileName } from '@/lib/filenames';
import { PdfPagesImage } from '@/components/PdfPagesImage';

export const dynamic = 'force-dynamic';

// In-portal attachment viewer for staff — embeds the file with a Back button so
// nobody gets stranded on a raw file view (mirrors the dealer viewer).
export default async function StaffAttachmentViewer({
  params,
}: {
  params: { id: string; attId: string };
}) {
  await requireStaffSection('mail');

  const mail = await prisma.mail.findUnique({
    where: { id: params.id },
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
        <Link href={`/staff/mail/${mail.id}`} className="text-sm text-gray-500 hover:underline">
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
          <PdfPagesImage pagesUrl={`${src}/pages`} downloadUrl={`${src}?download=1`} alt={name} />
        ) : (
          <div className="p-6 text-center text-sm text-gray-600">
            This file type can&apos;t be previewed.{' '}
            <a href={`${src}?download=1`} className="text-brand-700 hover:underline">Download it</a> to view.
          </div>
        )}
      </div>
    </div>
  );
}
