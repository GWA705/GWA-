import { notFound } from 'next/navigation';
import { UserPlus, GraduationCap, Camera, BadgeCheck } from 'lucide-react';
import { requireDealerAccess } from '@/lib/session';
import { prisma } from '@/lib/db';
import { listIdTagForDealer, isIdTagEnabledForDealer, ID_TAG_STATUS_LABEL, ID_TAG_STATUS_TONE, TONE_CLASS } from '@/lib/idTag';
import { SectionHero } from '@/components/SectionHero';
import { IdTagSubmitForm } from './IdTagSubmitForm';
import { SendTrainingButton } from './SendTrainingButton';
import { IdTagHeadshotButton } from '@/components/IdTagHeadshotButton';
import { changeIdTagHeadshotAction } from './actions';

export const dynamic = 'force-dynamic';

function appBase(): string {
  return (process.env.APP_URL || 'https://portal.ghsbarrie.ca').replace(/\/$/, '');
}

export default async function DealerIdTagsPage() {
  const session = await requireDealerAccess();
  if (!session.dealerId) {
    return <main className="mx-auto max-w-2xl px-4 py-10 text-center text-sm text-slate-500">No office is linked to your account.</main>;
  }
  const dealerId = session.dealerId;
  // Rollout gate: hidden from offices not enabled for the feature (GWA-only by default).
  if (!(await isIdTagEnabledForDealer(dealerId))) notFound();
  const [rows, dealer] = await Promise.all([
    listIdTagForDealer(dealerId),
    prisma.dealer.findUnique({ where: { id: dealerId }, select: { name: true, trainingToken: true } }),
  ]);
  const trainingLink = dealer?.trainingToken ? `${appBase()}/training/${dealer.trainingToken}` : null;

  return (
    <div className="space-y-6">
      <SectionHero
        eyebrow="Home Depot · In-store badges"
        title="Home Depot ID Tags"
        subtitle="Submit your team for their in-store Home Depot ID badge. Everyone should have a completed Lead Generator training certificate — if they don’t yet, we’ll flag it and give you the link to send them."
        bgImage="/id-tags-hero.webp"
        tiles={[
          { Icon: UserPlus, title: 'Add your team' },
          { Icon: GraduationCap, title: 'Training checked' },
          { Icon: Camera, title: 'Headshot' },
          { Icon: BadgeCheck, title: 'HD badge issued' },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,360px)_1fr]">
        <IdTagSubmitForm trainingLink={trainingLink} />

        <div className="overflow-hidden rounded-2xl bg-white shadow-lg shadow-slate-300/30 ring-1 ring-slate-200">
          <div className="border-b border-slate-100 px-5 py-3.5 text-sm font-bold text-slate-900">
            Your submitted people <span className="font-normal text-slate-400">· {rows.length}</span>
          </div>
          {rows.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-400">No one submitted yet. Add your first person on the left.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-2.5 font-semibold">Name</th>
                    <th className="px-5 py-2.5 font-semibold">Type</th>
                    <th className="px-5 py-2.5 font-semibold">Training</th>
                    <th className="px-5 py-2.5 font-semibold">Headshot</th>
                    <th className="px-5 py-2.5 font-semibold whitespace-nowrap">ID tag status</th>
                    <th className="px-5 py-2.5 font-semibold whitespace-nowrap">Added</th>
                    <th className="px-5 py-2.5 font-semibold"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100">
                      <td className="px-5 py-3 font-semibold text-slate-900">{r.personName}</td>
                      <td className="px-5 py-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${r.kind === 'EXISTING' ? 'bg-slate-100 text-slate-600' : 'bg-blue-100 text-blue-700'}`}>
                          {r.kind === 'EXISTING' ? 'Has tag' : 'New'}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {r.certified
                          ? <span className="text-xs font-bold text-green-700">✓ Certified</span>
                          : <span className="text-xs font-bold text-red-600">✗ Needs training</span>}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          {r.hasHeadshot
                            ? <span className="text-xs font-bold text-green-700">✓</span>
                            : <span className="text-xs font-bold text-amber-600">Missing</span>}
                          <IdTagHeadshotButton id={r.id} action={changeIdTagHeadshotAction} label={r.hasHeadshot ? 'Change' : 'Add'} small />
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE_CLASS[ID_TAG_STATUS_TONE[r.status]]}`}>
                          {ID_TAG_STATUS_LABEL[r.status]}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-400 whitespace-nowrap">{new Date(r.createdAt).toLocaleDateString('en-CA')}</td>
                      <td className="px-5 py-3">
                        {r.hasCard ? (
                          <div className="flex items-center gap-2">
                            {r.cardIsImage && (
                              <a href={`/api/id-tags/${r.id}/card?view=1`} target="_blank" rel="noreferrer" title="View / print card">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={`/api/id-tags/${r.id}/card?view=1`} alt="ID card" className="h-11 w-auto rounded border border-slate-200 bg-white" />
                              </a>
                            )}
                            <div className="flex flex-col gap-1">
                              <a href={`/api/id-tags/${r.id}/card?view=1`} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-300 px-2.5 py-1 text-center text-xs font-semibold text-slate-700 hover:bg-slate-50">View / print</a>
                              <a href={`/api/id-tags/${r.id}/card`} className="rounded-lg bg-brand-600 px-2.5 py-1 text-center text-xs font-semibold text-white hover:bg-brand-700">⬇ Download</a>
                            </div>
                          </div>
                        ) : r.kind === 'NEW' && !r.certified && r.personEmail ? (
                          <SendTrainingButton id={r.id} label="Send training" small />
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
