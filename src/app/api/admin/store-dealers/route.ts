import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { canAdminSection } from '@/lib/rbac';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/**
 * Admin export of every HD store and the dealer it belongs to — for sharing
 * with another site. CSV by default (opens as a download); ?format=json returns
 * JSON. Admin-only (the same "dealers" section that manages stores), and the
 * export is audit-logged.
 *
 *   /api/admin/store-dealers            → CSV download
 *   /api/admin/store-dealers?format=json → JSON
 *   &includeInactive=1                   → also include archived stores/dealers
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  if (!canAdminSection(session, 'dealers')) return new NextResponse('Forbidden', { status: 403 });

  const includeInactive = req.nextUrl.searchParams.get('includeInactive') === '1';
  const format = (req.nextUrl.searchParams.get('format') || 'csv').toLowerCase();

  const stores = await prisma.homeDepotStore.findMany({
    where: includeInactive ? {} : { active: true, dealer: { active: true } },
    select: {
      number: true,
      name: true,
      active: true,
      dealer: { select: { id: true, name: true, active: true } },
    },
    orderBy: [{ dealer: { name: 'asc' } }, { number: 'asc' }],
  });

  const rows = stores.map((s) => ({
    storeNumber: s.number,
    storeName: s.name ?? '',
    storeActive: s.active,
    dealerName: s.dealer?.name ?? '',
    dealerId: s.dealer?.id ?? '',
    dealerActive: s.dealer?.active ?? false,
  }));

  await audit({
    actorId: session.userId,
    action: 'DATA_EXPORT',
    entityType: 'HomeDepotStore',
    entityId: 'store-dealer-list',
    detail: `Exported ${rows.length} store→dealer rows (${format}${includeInactive ? ', incl. inactive' : ''})`,
  });

  if (format === 'json') {
    return NextResponse.json(
      { generatedAt: new Date().toISOString(), count: rows.length, stores: rows },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  // CSV
  const esc = (v: unknown) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ['Store Number', 'Store Name', 'Store Active', 'Dealer', 'Dealer Active', 'Dealer ID'];
  const lines = [
    header.join(','),
    ...rows.map((r) =>
      [r.storeNumber, r.storeName, r.storeActive ? 'yes' : 'no', r.dealerName, r.dealerActive ? 'yes' : 'no', r.dealerId]
        .map(esc)
        .join(','),
    ),
  ];
  const csv = lines.join('\r\n');
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="hd-stores-dealers-${stamp}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
