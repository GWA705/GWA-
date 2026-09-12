import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { canViewDealerSnapshot } from '@/lib/reporting/access';
import { buildGiftCardReport } from '@/lib/reporting/giftCardReport';
import { GiftCardReportView } from '../GiftCardReportView';

export const dynamic = 'force-dynamic';

export default async function GiftCardReportPage() {
  // Cross-office report — gate to the Dealer-Snapshot grant (super admins have
  // it implicitly), so it matches the other cross-dealer reports rather than
  // being openable by any scoped admin.
  const user = await requireRole('REVIEWER', 'ADMIN');
  if (!(await canViewDealerSnapshot(user))) notFound();

  const report = await buildGiftCardReport();

  return (
    <div className="space-y-5">
      <Link href="/staff/reports" className="text-sm text-gray-500 hover:underline">← All reports</Link>
      <GiftCardReportView report={report} />
    </div>
  );
}
