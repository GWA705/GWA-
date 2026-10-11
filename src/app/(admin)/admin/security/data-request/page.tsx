import Link from 'next/link';
import { requireAdminSection } from '@/lib/session';
import { DataRequestTool } from './DataRequestTool';

export const dynamic = 'force-dynamic';

export default async function DataRequestPage() {
  await requireAdminSection('security');
  return (
    <div className="max-w-2xl space-y-4">
      <Link href="/admin/security" className="text-sm text-gray-500 hover:underline">← Security</Link>
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Customer data requests</h1>
        <p className="mt-1 text-sm text-gray-500">
          Look up what we hold for a customer, and — on an access/erasure request — erase their texting and
          marketing-lead data. Funded deals and HD cases are kept under financing/tax retention obligations (a
          PIPEDA exception) and are shown read-only. Every lookup and erasure is logged.
        </p>
      </div>
      <DataRequestTool />
    </div>
  );
}
