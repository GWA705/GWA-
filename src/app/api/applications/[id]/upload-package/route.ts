import { NextResponse } from 'next/server';
import JSZip from 'jszip';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { getDocument } from '@/lib/storage';
import { audit } from '@/lib/audit';
import { DOCUMENT_TYPE_LABELS } from '@/lib/constants';

// "Upload package" download: only the documents a reviewer sends OUT to the
// funder / Home Depot, cleanly named, as one flat ZIP. This is the general
// (un-curated) version — it includes the completed outbound docs and leaves the
// reviewer to pick what each funder needs. The curated, funder-specific subset
// (e.g. HD+Enercare -> Enercare application + certificate of completion + HD
// contract + HD waiver) is layered on top once those parameters are configured.
//
// Outbound docs = FUNDING stage (the signed package + install photos + void
// cheque/PAP) and REVIEWER stage (HD agreements, certificate of completion,
// financing paperwork). APPLICATION-stage intake is deliberately excluded — it's
// internal and not part of what gets uploaded to the funder.
const OUTBOUND_STAGES = ['FUNDING', 'REVIEWER'] as const;

const clean = (s: string) => (s || '').replace(/[^a-zA-Z0-9]+/g, '') || 'x';

// Original file extension (kept so the funder's system recognizes the type),
// falling back to a mime-based guess.
function extOf(fileName: string, mimeType: string): string {
  const m = /(\.[a-z0-9]{1,8})$/i.exec(fileName || '');
  if (m) return m[1].toLowerCase();
  if (mimeType === 'application/pdf') return '.pdf';
  if (mimeType === 'image/jpeg') return '.jpg';
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  return '';
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  if (session.role !== 'ADMIN' && session.role !== 'REVIEWER') {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const app = await prisma.application.findUnique({
    where: { id: params.id },
    include: {
      documents: {
        where: { stage: { in: [...OUTBOUND_STAGES] } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!app) return new NextResponse('Not found', { status: 404 });
  if (app.documents.length === 0) {
    return new NextResponse('No upload-package documents on this deal yet', { status: 404 });
  }

  // Bound the archive so a deal with very many/large files can't exhaust memory.
  const MAX_ZIP_BYTES = 200 * 1024 * 1024; // 200 MB of decrypted content
  const MAX_ZIP_FILES = 200;

  const zip = new JSZip();
  const used = new Set<string>();
  const customer = `${clean(app.applicantLastName)}_${clean(app.applicantFirstName)}`;
  let added = 0;
  let totalBytes = 0;
  let truncated = false;

  for (const doc of app.documents) {
    if (added >= MAX_ZIP_FILES) { truncated = true; break; }
    let bytes: Buffer;
    try {
      bytes = await getDocument(doc.storageKey);
    } catch (err) {
      console.error('[upload-package] skipping unreadable document', doc.id, err);
      continue; // an orphaned/missing file shouldn't fail the whole ZIP
    }
    if (totalBytes + bytes.length > MAX_ZIP_BYTES) { truncated = true; break; }
    totalBytes += bytes.length;

    // Proper, funder-friendly name: "Smith_Sean - Home Depot waiver.pdf".
    const typeLabel = doc.label?.trim() || DOCUMENT_TYPE_LABELS[doc.type] || 'Document';
    const ext = extOf(doc.fileName, doc.mimeType);
    const baseName = `${customer} - ${typeLabel}`.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
    let name = `${baseName}${ext}`;
    if (used.has(name)) {
      let n = 2;
      while (used.has(`${baseName} (${n})${ext}`)) n += 1;
      name = `${baseName} (${n})${ext}`;
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
    detail: `Upload package ZIP (${added} document${added === 1 ? '' : 's'}${truncated ? `, capped at ${added} of ${app.documents.length}` : ''})`,
  });

  const fileName = `GWA_${customer}_upload-package.zip`;
  return new NextResponse(new Uint8Array(content), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
