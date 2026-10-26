import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdminSection } from '@/lib/session';
import { getStoreContact, DISTRICT_SEED } from '@/lib/hdStoreContacts';
import { StoreContactEditForm } from '../StoreContactEditForm';
import { deleteStoreContactAction } from '../actions';

export const dynamic = 'force-dynamic';

export default async function StoreContactEditPage({ params }: { params: { store: string } }) {
  await requireAdminSection('store-contacts');
  const isNew = params.store === 'new';
  const existing = isNew ? null : await getStoreContact(params.store.replace(/\D/g, ''));
  if (!isNew && !existing) notFound();

  const init = {
    storeNumber: existing?.storeNumber ?? '',
    storeName: existing?.storeName ?? '',
    district: existing?.district ?? (existing ? '' : ''),
    storeContacts: existing?.storeContacts ?? '',
    ism: existing?.ism ?? '',
    distributor: existing?.distributor ?? '',
    officeManager: existing?.officeManager ?? '',
    active: existing?.active ?? true,
    isNew,
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link href="/admin/store-contacts" className="text-sm text-gray-500 hover:underline">← Store contacts</Link>
          <h1 className="mt-1 text-xl font-semibold text-gray-900">{isNew ? 'Add a store' : `${existing!.storeNumber} — ${existing!.storeName ?? ''}`}</h1>
        </div>
        {!isNew && (
          <form action={deleteStoreContactAction.bind(null, existing!.storeNumber)}>
            <button type="submit" className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">Delete</button>
          </form>
        )}
      </div>
      <div className="card p-6">
        <StoreContactEditForm init={init} />
      </div>
      {isNew && (
        <p className="text-xs text-gray-400">Tip: districts auto-fill on CSV import. Known districts include {Object.values(DISTRICT_SEED).filter((v, i, a) => a.indexOf(v) === i).slice(0, 4).join(', ')}, …</p>
      )}
    </div>
  );
}
