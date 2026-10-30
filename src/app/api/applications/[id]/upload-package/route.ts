import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { streamDocumentsZip, type ZipEntry } from '@/lib/zipStream';
import { audit } from '@/lib/audit';
import { DOCUMENT_TYPE_LABELS } from '@/lib/constants';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

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

  // A generous guard — streaming keeps memory flat regardless of file size.
  const MAX_ZIP_FILES = 500;

  const used = new Set<string>();
  const customer = `${clean(app.applicantLastName)}_${clean(app.applicantFirstName)}`;
  const entries: ZipEntry[] = [];

  for (const doc of app.documents) {
    if (entries.length >= MAX_ZIP_FILES) break;

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
    entries.push({ storageKey: doc.storageKey, name });
  }

  const { stream } = streamDocumentsZip(entries);

  await audit({
    actorId: session.userId,
    action: 'DOC_DOWNLOAD',
    entityType: 'Application',
    entityId: app.id,
    detail: `Upload package ZIP (${entries.length} of ${app.documents.length} document${app.documents.length === 1 ? '' : 's'})`,
  });

  const fileName = `GWA_${customer}_upload-package.zip`;
  return new NextResponse(stream, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
