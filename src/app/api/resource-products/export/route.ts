import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { canAdminSection, isSuperAdmin } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { portalBaseUrl } from '@/lib/onboard';

export const dynamic = 'force-dynamic';

// Product catalog export (CSV) for the booking site's importer. One row per
// product in the Resource Library, with the stable SKU (journalName), category,
// photo/manual/spec URLs, and the portal deep-link. Admin-only.
//
// NOTE: the photo/file URLs are portal routes behind login — good for an
// "Open in portal" link and for re-fetching, but a public site can't hotlink
// them. To publish images/PDFs publicly, export the media too (say the word).

const FILE_KINDS = ['MANUAL', 'SPEC_SHEET', 'BROCHURE', 'WARRANTY'] as const;

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  if (!isSuperAdmin(session) && !canAdminSection(session, 'resource-library')) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const base = portalBaseUrl();
  const products = await prisma.resourceProduct.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    include: { files: { orderBy: { sortOrder: 'asc' } } },
  });

  const fileUrl = (id: string) => `${base}/api/resource-files/${id}`;

  const headers = [
    'sku', 'name', 'category', 'brand', 'model_number', 'description',
    'photo_url', 'manual_url', 'spec_sheet_url', 'brochure_url', 'warranty_url',
    'other_files', 'portal_url', 'active', 'updated_at',
  ];

  const rows = products.map((p) => {
    const pick = (kind: string) => p.files.find((f) => f.kind === kind);
    const named = FILE_KINDS.map(pick);
    const usedIds = new Set(named.filter(Boolean).map((f) => f!.id));
    const others = p.files.filter((f) => !usedIds.has(f.id));
    const [manual, spec, brochure, warranty] = named;
    return [
      p.journalName ?? p.id, // sku — the stable key; falls back to the row id
      p.title,
      p.category ?? '',
      p.brand ?? '',
      p.modelNumber ?? '',
      p.description ?? '',
      p.imageStorageKey ? `${base}/api/resource-products/${p.id}/image` : '',
      manual ? fileUrl(manual.id) : '',
      spec ? fileUrl(spec.id) : '',
      brochure ? fileUrl(brochure.id) : '',
      warranty ? fileUrl(warranty.id) : '',
      others.map((f) => fileUrl(f.id)).join(' ; '),
      `${base}/dealer/resources/library/${p.id}`,
      p.active ? 'yes' : 'no',
      p.updatedAt.toISOString(),
    ];
  });

  // Prefix a BOM so Excel opens the UTF-8 CSV cleanly.
  const csv = '﻿' + [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="gwa-products-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
