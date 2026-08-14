import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdminSection } from '@/lib/session';
import { prisma } from '@/lib/db';
import { DealerProfileForm } from '@/components/DealerProfileForm';
import { readExtraContacts } from '@/lib/dealerProfile';
import { saveDealerProfileAdminAction } from '@/app/(admin)/actions';

export const dynamic = 'force-dynamic';

export default async function DirectoryEditPage({ params }: { params: { dealerId: string } }) {
  await requireAdminSection('directory');
  const dealer = await prisma.dealer.findUnique({
    where: { id: params.dealerId },
    include: { profile: true },
  });
  if (!dealer) notFound();

  const values = { ...(dealer.profile ?? {}), businessName: dealer.profile?.businessName ?? dealer.name, extraContacts: readExtraContacts(dealer.profile?.extraContacts) };
  const logoUrl = dealer.profile?.logoStorageKey ? `/api/dealer-profiles/${dealer.id}/logo?v=${dealer.profile.updatedAt.getTime()}` : null;
  const action = saveDealerProfileAdminAction.bind(null, dealer.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/staff/directory" className="text-sm text-gray-500 hover:underline">← Back to directory</Link>
        <h1 className="mt-2 text-xl font-semibold text-gray-900">{dealer.name} — office profile</h1>
        <p className="mt-1 text-sm text-gray-500">Editing on behalf of this office. Changes appear in the directory immediately.</p>
      </div>
      <section className="card p-6">
        <DealerProfileForm action={action} values={values} logoUrl={logoUrl} saveLabel="Save profile" />
      </section>
    </div>
  );
}
