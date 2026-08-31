import Link from 'next/link';
import { requireSuperAdmin } from '@/lib/session';
import { dealCounts, mailCounts } from '@/lib/goLiveReset';
import { ResetPanel } from './ResetPanel';

export const dynamic = 'force-dynamic';

export default async function ResetPage() {
  await requireSuperAdmin();
  const [deals, mail] = await Promise.all([dealCounts(), mailCounts()]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin" className="text-sm text-brand-700 hover:underline">← Admin</Link>
        <h1 className="mt-1 text-xl font-semibold text-gray-900">Reset test data</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-600">
          Clears data entered during testing so you can start the live week clean. Each wipe is
          separate, needs a typed confirmation, and is logged. It does <strong>not</strong> touch
          dealers, users, marketplace, resources, finance companies, products, gift cards, or
          settings. To hide test <em>logins</em> instead of deleting them, deactivate each user and
          use &ldquo;Hide deactivated&rdquo; on the Users page.
        </p>
      </div>

      <div className="rounded-lg border-l-4 border-amber-500 bg-amber-50 p-3 text-sm text-amber-800">
        These deletions are permanent and run against the live database. Make sure a database backup
        is in place first.
      </div>

      <ResetPanel
        deals={{ deals: deals.deals, files: deals.files, notes: deals.notes, decisions: deals.decisions, payouts: deals.payouts }}
        mail={{ mails: mail.mails, replies: mail.replies, attachments: mail.attachments }}
      />
    </div>
  );
}
