import Link from 'next/link';
import { requireSuperAdmin } from '@/lib/session';
import { guustoConfigured, guustoBaseUrl } from '@/lib/guusto';
import { GuustoTestForm } from './GuustoTestForm';

export const dynamic = 'force-dynamic';

// A candidate body — a best guess at the field names. The response from a real
// call tells us the exact shape; we adjust from there.
const CANDIDATE = JSON.stringify(
  {
    currency: 'CAD',
    language: 'EN_CA',
    merchant: 'The Home Depot',
    reason: 'BARRIE, Completed Water Test with HD Home Services',
    claimPeriod: '1_MONTH',
    orderItems: [
      {
        amount: 1,
        message: 'Test from the Georgian Water & Air portal',
        recipient: { firstName: 'Sean', lastName: 'Jaiko', email: 'sean@ghsbarrie.ca' },
      },
    ],
  },
  null,
  2,
);

export default async function GuustoTestPage() {
  await requireSuperAdmin();
  const configured = guustoConfigured();
  const base = guustoBaseUrl();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/gift-cards" className="text-sm text-brand-700 hover:underline">← Gift cards</Link>
        <h1 className="mt-1 text-xl font-semibold text-gray-900">Guusto API — test harness</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-600">
          Send a raw call to the Guusto API to confirm the exact request shape against your live
          account, before we wire it into gift-card approvals. Start with a small <strong>$1</strong> test
          to your own email. The response is shown in full so we can lock the field names.
        </p>
      </div>

      {configured ? (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          Token detected. API base: <code className="rounded bg-white/70 px-1">{base}</code>{' '}
          <span className="text-green-700">(override per-call below, or set <code>GUUSTO_API_BASE</code> in Render).</span>
        </div>
      ) : (
        <div className="rounded-lg border-l-4 border-amber-500 bg-amber-50 p-3 text-sm text-amber-800">
          No <code>GUUSTO_API_TOKEN</code> is set. Add it in <strong>Render → Environment</strong> and redeploy, then
          come back here to test. Nothing sends until the token is in place.
        </div>
      )}

      <GuustoTestForm defaultBase={base} candidate={CANDIDATE} disabled={!configured} />

      <p className="max-w-2xl text-xs text-gray-400">
        Heads-up: a successful call sends a <em>real</em> reward and draws from your Guusto balance. Keep the
        amount at $1 and the recipient as your own email while we confirm the format.
      </p>
    </div>
  );
}
