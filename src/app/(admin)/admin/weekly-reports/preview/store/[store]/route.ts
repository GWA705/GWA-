import { NextResponse } from 'next/server';
import { requireAdminSection } from '@/lib/session';
import { lastFullWeek, assembleStoreReports, renderStoreEmailHtml } from '@/lib/reporting/weeklyReports';

export const dynamic = 'force-dynamic';

/** Render one store's weekly email (for in-portal preview). */
export async function GET(_req: Request, { params }: { params: { store: string } }) {
  await requireAdminSection('weekly-reports');
  const reports = await assembleStoreReports(lastFullWeek());
  const r = reports.find((x) => x.storeNumber === params.store.replace(/\D/g, ''));
  if (!r) return new NextResponse('No sales for that store in the last full week.', { status: 404 });
  return new NextResponse(renderStoreEmailHtml(r), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}
