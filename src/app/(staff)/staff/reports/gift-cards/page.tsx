import Link from 'next/link';
import { requireRole } from '@/lib/session';
import { buildGiftCardReport } from '@/lib/reporting/giftCardReport';
import { GiftCardReportView } from '../GiftCardReportView';

export const dynamic = 'force-dynamic';

export default async function GiftCardReportPage() {
  // Admin-only, as requested ("currently just admin view").
  await requireRole('ADMIN');

  const report = await buildGiftCardReport();

  return (
    <div className="space-y-5">
      <Link href="/staff/reports" className="text-sm text-gray-500 hover:underline">← All reports</Link>
      <GiftCardReportView report={report} />
    </div>
  );
}
