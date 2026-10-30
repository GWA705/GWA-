import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { monthlyActivations, buildIdTagInvoicePdf } from '@/lib/idTagBilling';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/**
 * Printable per-office Home Depot ID-tag invoice (PDF). Staff can download any
 * office; a dealer can download only their OWN office's invoice.
 *   /api/id-tags/invoice?dealerId=<id>&month=YYYY-MM
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const q = new URL(req.url).searchParams;
  const dealerId = (q.get('dealerId') || '').trim();
  const month = (q.get('month') || '').trim();
  if (!dealerId || !/^\d{4}-\d{2}$/.test(month)) {
    return new NextResponse('Bad request — need dealerId and month=YYYY-MM', { status: 400 });
  }
  const isStaff = session.role === 'REVIEWER' || session.role === 'ADMIN';
  // A dealer is scoped to their own office; staff see any.
  if (!isStaff && session.dealerId !== dealerId) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const billing = await monthlyActivations(month);
  const bill = billing.offices.find((o) => o.dealerId === dealerId);
  if (!bill) return new NextResponse('No activity for that office in that month', { status: 404 });

  const bytes = await buildIdTagInvoicePdf(bill, month);
  await audit({ actorId: session.userId, action: 'DOC_DOWNLOAD', entityType: 'Dealer', entityId: dealerId, detail: `ID-tag invoice ${month}` });
  const fname = `HD-ID-Invoice-${(bill.office || 'office').replace(/[^a-zA-Z0-9]+/g, '-')}-${month}.pdf`;
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fname}"`,
      'Cache-Control': 'no-store',
    },
  });
}
