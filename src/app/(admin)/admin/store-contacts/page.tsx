import Link from 'next/link';
import { requireAdminSection } from '@/lib/session';
import { listStoreContacts, resolveStoreRecipients, getNationalRecipients } from '@/lib/hdStoreContacts';
import { getSetting } from '@/lib/settings';
import { ImportContactsForm, NationalRecipientsForm } from './ContactsAdminForms';

export const dynamic = 'force-dynamic';

export default async function StoreContactsPage() {
  await requireAdminSection('store-contacts');
  const [stores, national, nationalRaw] = await Promise.all([
    listStoreContacts(),
    getNationalRecipients(),
    getSetting('hdReport.nationalRecipients'),
  ]);

  const districts = Array.from(new Set(stores.map((s) => s.district).filter(Boolean))).sort();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">HD Store contacts</h1>
          <p className="mt-1 text-sm text-gray-500 max-w-2xl">
            Who the weekly Home Depot store reports go to, per store — the portal's own copy of your contacts sheet.
            Edit anytime; changes take effect on the next send. Store ownership (which GWA office) still follows the
            portal's stores, not this list. <strong>Every recipient is BCC&rsquo;d on every send</strong> — the email shows
            only <strong>reporter@ghsbarrie.ca</strong> in the To line, so no store, distributor, ISM or office manager
            ever sees another recipient.
          </p>
        </div>
        <Link href="/admin/store-contacts/new" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">+ Add store</Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5"><h2 className="mb-2 text-base font-semibold text-gray-900">Import from the contacts sheet</h2><ImportContactsForm /></section>
        <section className="card p-5"><h2 className="mb-2 text-base font-semibold text-gray-900">National report recipients <span className="text-xs font-normal text-gray-400">· {national.length}</span></h2><NationalRecipientsForm initial={nationalRaw ?? ''} /></section>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">Stores <span className="text-sm font-normal text-gray-400">· {stores.length}</span></h2>
        <span className="text-xs text-gray-400">{districts.length} districts</span>
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Store</th>
              <th className="px-4 py-3">District</th>
              <th className="px-4 py-3">Recipients</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {stores.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No stores yet — paste your contacts CSV above to seed them.</td></tr>
            ) : stores.map((s) => {
              const { to, cc } = resolveStoreRecipients(s);
              return (
                <tr key={s.id} className={s.active ? '' : 'opacity-60'}>
                  <td className="px-4 py-3"><span className="font-mono text-gray-500">{s.storeNumber}</span> <span className="font-medium text-gray-900">{s.storeName ?? ''}</span></td>
                  <td className="px-4 py-3 text-gray-600">{s.district ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-gray-600">{to.length + cc.length === 0 ? <span className="text-amber-600">⚠ none</span> : <>{to.length + cc.length} recipient{to.length + cc.length === 1 ? '' : 's'} <span className="text-gray-400">· all BCC&rsquo;d</span></>}</td>
                  <td className="px-4 py-3">{s.active ? <span className="badge bg-green-100 text-green-800">Active</span> : <span className="badge bg-gray-100 text-gray-600">Off</span>}</td>
                  <td className="px-4 py-3 text-right"><Link href={`/admin/store-contacts/${s.storeNumber}`} className="text-sm font-medium text-brand-700 hover:underline">Edit</Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
