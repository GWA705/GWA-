import Link from 'next/link';
import { requireAdminSection } from '@/lib/session';
import { listReconcileCandidates } from '@/app/(staff)/actions';
import { ReconcileDealsTable } from './ReconcileDealsTable';

export const dynamic = 'force-dynamic';

export default async function ReconcileDealsPage() {
  // Reuses the Overview admin permission — no separate section to grant.
  await requireAdminSection('overview');
  const deals = await listReconcileCandidates();

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-1 flex items-center gap-2 text-sm">
          <Link href="/admin" className="text-brand-700 hover:underline">← Admin</Link>
        </div>
        <h1 className="text-xl font-semibold text-gray-900">Reconcile deals → Funded</h1>
        <p className="mt-1 max-w-3xl text-sm text-gray-500">
          Deals sitting at <strong>Approved / Conditional</strong> that were never carried through to Funded —
          typically GWA direct sales and older deals that are already settled in real life. Tick the ones that are
          done and mark them <strong>Funded</strong> in one go, then fill the sales journal as usual (your paid-sync
          then marks them <strong>Paid</strong>). A deal missing a required number (HD Customer # / financing number)
          can&apos;t be selected and shows why — fix those on the deal page.
        </p>
      </div>

      <ReconcileDealsTable deals={deals} />
    </div>
  );
}
