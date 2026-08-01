import { NextResponse } from 'next/server';
import JSZip from 'jszip';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { getDocument } from '@/lib/storage';
import { audit } from '@/lib/audit';

// Bulk download: all of a deal's documents as a single ZIP, decrypted on the
// fly. Reviewer/admin only, access-logged. Files are foldered by stage and
// de-duplicated so nothing is silently overwritten inside the archive.
const STAGE_FOLDER: Record<string, string> = {
  APPLICATION: 'Application documents',
  FUNDING: 'Funding package',
  REVIEWER: 'Paperwork for dealer',
};

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

  // Bound the archive so a deal with very many/large files can't exhaust memory.
  const MAX_ZIP_BYTES = 200 * 1024 * 1024; // 200 MB of decrypted content
  const MAX_ZIP_FILES = 200;

  const zip = new JSZip();
  const used = new Set<string>();
  let added = 0;
  let totalBytes = 0;
  let truncated = false;

  for (const doc of app.documents) {
    if (added >= MAX_ZIP_FILES) { truncated = true; break; }
    let bytes: Buffer;
    try {
      bytes = await getDocument(doc.storageKey);
    } catch (err) {
      console.error('[zip] skipping unreadable document', doc.id, err);
      continue; // an orphaned/missing file shouldn't fail the whole ZIP
    }
    if (totalBytes + bytes.length > MAX_ZIP_BYTES) { truncated = true; break; }
    totalBytes += bytes.length;
    const folder = STAGE_FOLDER[doc.stage] || 'Other';
    let name = `${folder}/${doc.fileName}`;
    // De-dupe identical paths inside the archive.
    if (used.has(name)) {
      const dot = doc.fileName.lastIndexOf('.');
      const base = dot > 0 ? doc.fileName.slice(0, dot) : doc.fileName;
      const ext = dot > 0 ? doc.fileName.slice(dot) : '';
      let n = 2;
      while (used.has(`${folder}/${base} (${n})${ext}`)) n += 1;
      name = `${folder}/${base} (${n})${ext}`;
    }
    used.add(name);
    zip.file(name, bytes);
    added += 1;
  }

  if (added === 0) return new NextResponse('Documents could not be read', { status: 500 });

  const content = await zip.generateAsync({ type: 'nodebuffer' });

  await audit({
    actorId: session.userId,
    action: 'DOC_DOWNLOAD',
    entityType: 'Application',
    entityId: app.id,
    detail: `Bulk ZIP download (${added} document${added === 1 ? '' : 's'}${truncated ? `, capped at ${added} of ${app.documents.length}` : ''})`,
  });

  const clean = (s: string) => (s || '').replace(/[^a-zA-Z0-9]+/g, '') || 'x';
  const fileName = `GWA_${clean(app.applicantLastName)}_${clean(app.applicantFirstName)}_documents.zip`;

  return new NextResponse(new Uint8Array(content), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
