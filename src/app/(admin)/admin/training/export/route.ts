import { requireAdminSection } from '@/lib/session';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// All training certifications across every office, as CSV — the company-wide
// training record for Home Depot. Admin-gated.
export async function GET(req: Request) {
  await requireAdminSection('training');

  const office = new URL(req.url).searchParams.get('office');
  const where = office && office !== 'all' ? { dealerId: office } : undefined;

  const rows = await prisma.trainingCertification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { dealer: { select: { name: true } } },
  });

  const header = ['Completed', 'Office', 'Name', 'Email', 'Phone', 'Address', 'City', 'Postal code', 'Start date', 'Score %', 'Passed', 'Signature', 'Program version', 'IP'];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([
      r.createdAt.toISOString(),
      r.dealer?.name ?? '',
      r.traineeName,
      r.traineeEmail,
      r.traineePhone,
      r.traineeAddress ?? '',
      r.traineeCity ?? '',
      r.traineePostal ?? '',
      r.startDate ?? '',
      r.score,
      r.passed ? 'Yes' : 'No',
      r.signatureName,
      r.contentVersion,
      r.ipAddress ?? '',
    ].map(csvCell).join(','));
  }
  const csv = lines.join('\n');
  const today = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="GWA-training-records-${today}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
