import { requireDealerAccess } from '@/lib/session';
import { prisma } from '@/lib/db';
import { DealerProfileForm } from '@/components/DealerProfileForm';
import { readExtraContacts } from '@/lib/dealerProfile';
import { saveDealerProfileAction } from '@/app/(dealer)/actions';

export const dynamic = 'force-dynamic';

export default async function DealerProfilePage() {
  const user = await requireDealerAccess();
  const [profile, dealer] = await Promise.all([
    user.dealerId ? prisma.dealerProfile.findUnique({ where: { dealerId: user.dealerId } }) : null,
    user.dealerId ? prisma.dealer.findUnique({ where: { id: user.dealerId }, select: { name: true } }) : null,
  ]);

  // Prefill the business name from the dealership name on a first-time profile.
  const values = { ...(profile ?? {}), businessName: profile?.businessName ?? dealer?.name ?? '', extraContacts: readExtraContacts(profile?.extraContacts) };
  const logoUrl = profile?.logoStorageKey && user.dealerId ? `/api/dealer-profiles/${user.dealerId}/logo?v=${profile.updatedAt.getTime()}` : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Office profile</h1>
        <p className="mt-1 text-sm text-gray-600">
          Keep your office details up to date so the GWA team always has the right contacts. This is
          shared with GWA reviewers and admins only — it is not shown to other dealers.
        </p>
      </div>
      <section className="card p-6">
        <DealerProfileForm action={saveDealerProfileAction} values={values} logoUrl={logoUrl} />
      </section>
    </div>
  );
}
