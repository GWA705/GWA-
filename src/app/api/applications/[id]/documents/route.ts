import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { streamDocumentsZip, type ZipEntry } from '@/lib/zipStream';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Bulk download: all of a deal's documents as a single ZIP, decrypted on the
// fly and STREAMED (one file at a time) so a deal with many/large files can't
// exhaust the instance's memory. Reviewer/admin only, access-logged. Files are
// foldered by stage and de-duplicated so nothing is silently overwritten.
const STAGE_FOLDER: Record<string, string> = {
  APPLICATION: 'Application documents',
  FUNDING: 'Funding package',
  REVIEWER: 'Paperwork for dealer',
};

// A generous guard — streaming keeps memory flat regardless, but this bounds a
// pathological deal. Well above any real deal's file count.
const MAX_ZIP_FILES = 500;

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  if (session.role !== 'ADMIN' && session.role !== 'REVIEWER') {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const app = await prisma.application.findUnique({
    where: { id: params.id },
    include: { documents: { orderBy: { createdAt: 'asc' } } },
  });
  if (!app) return new NextResponse('Not found', { status: 404 });
  if (app.documents.length === 0) return new NextResponse('No documents to download', { status: 404 });

  // Resolve archive paths up front (foldered + de-duped); the bytes are fetched
  // lazily while streaming.
  const used = new Set<string>();
  const entries: ZipEntry[] = [];
  for (const doc of app.documents) {
    if (entries.length >= MAX_ZIP_FILES) break;
    const folder = STAGE_FOLDER[doc.stage] || 'Other';
    let name = `${folder}/${doc.fileName}`;
    if (used.has(name)) {
      const dot = doc.fileName.lastIndexOf('.');
      const base = dot > 0 ? doc.fileName.slice(0, dot) : doc.fileName;
      const ext = dot > 0 ? doc.fileName.slice(dot) : '';
      let n = 2;
      while (used.has(`${folder}/${base} (${n})${ext}`)) n += 1;
      name = `${folder}/${base} (${n})${ext}`;
    }
    used.add(name);
    entries.push({ storageKey: doc.storageKey, name });
  }

  const { stream } = streamDocumentsZip(entries);

  await audit({
    actorId: session.userId,
    action: 'DOC_DOWNLOAD',
    entityType: 'Application',
    entityId: app.id,
    detail: `Bulk ZIP download (${entries.length} of ${app.documents.length} document${app.documents.length === 1 ? '' : 's'})`,
  });

  const clean = (s: string) => (s || '').replace(/[^a-zA-Z0-9]+/g, '') || 'x';
  const fileName = `GWA_${clean(app.applicantLastName)}_${clean(app.applicantFirstName)}_documents.zip`;

  return new NextResponse(stream, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
