import { NextResponse } from 'next/server';
import JSZip from 'jszip';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { getDocument } from '@/lib/storage';
import { audit } from '@/lib/audit';
import { DOCUMENT_TYPE_LABELS } from '@/lib/constants';

// "Upload package" download: ONLY the dealer's returned FINAL copies — the
// signed package + install photos + void cheque/PAP — cleanly named, as one flat
// ZIP. These are the FUNDING-stage documents the dealer uploads back.
//
// Deliberately EXCLUDED:
//  - REVIEWER stage — blank paperwork/agreements GWA staff upload FOR the dealer
//    to complete (HD paperwork, financing paperwork, release of funds). The
//    dealer returns the COMPLETED versions as FUNDING, so including the staff
//    templates here just doubled up the package with non-final copies.
//  - APPLICATION stage — internal intake, never part of the funder upload.
const OUTBOUND_STAGES = ['FUNDING'] as const;

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
    // The HD waiver uses Home Depot's required upload naming convention:
    // "#WAIVER#<HD Ref #>" — the literal "#WAIVER#" tag followed directly by the
    // 800-series HD reference number (no brackets). Falls back to the normal
    // customer-based name if there's no HD reference.
    const rawBase =
      doc.type === 'HD_WAIVER' && app.hdReference?.trim()
        ? `#WAIVER#${app.hdReference.trim()}`
        : `${customer} - ${typeLabel}`;
    const baseName = rawBase.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
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
