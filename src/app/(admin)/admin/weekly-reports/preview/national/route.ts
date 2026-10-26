import { NextResponse } from 'next/server';
import { requireAdminSection } from '@/lib/session';
import { lastFullWeek, assembleNational, renderNationalEmailHtml } from '@/lib/reporting/weeklyReports';

export const dynamic = 'force-dynamic';

/** Render the National weekly email (for in-portal preview). */
export async function GET() {
  await requireAdminSection('weekly-reports');
  const html = renderNationalEmailHtml(await assembleNational(lastFullWeek()));
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}
