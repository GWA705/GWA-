import Link from 'next/link';
import { requireAdminSection } from '@/lib/session';
import { prisma } from '@/lib/db';
import { DealerForm } from './DealerForm';
import { DealerRowActions } from './DealerRowActions';
import { DealerJournalNameForm } from './DealerJournalNameForm';
import { getDigestFlyer } from '@/lib/settings';
import { saveSnapshotFlyerAction, clearSnapshotFlyerAction } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function DealersPage() {
  await requireAdminSection('dealers');
  const dealers = await prisma.dealer.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { users: true, applications: true } } },
  });
  const flyer = await getDigestFlyer();
  // Pin the Georgian Water & Air house account(s) to the top — it's the
  // most-used "View as" target. Stable sort keeps newest-first within each group.
  const isHouse = (name: string) => /georgian\s+water/i.test(name);
  dealers.sort((a, b) => Number(isHouse(b.name)) - Number(isHouse(a.name)));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900">Dealers</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Link href="/admin/dealers/routing" className="font-medium text-brand-700 hover:underline">
            Store routing
          </Link>
          <span className="text-gray-300">·</span>
          <Link href="/admin/dealers/locations" className="font-medium text-brand-700 hover:underline">
            Store map locations
          </Link>
          <span className="text-gray-300">·</span>
          <span className="text-xs text-gray-400">HD store → dealer list:</span>
          <a href="/api/admin/store-dealers" className="font-medium text-brand-700 hover:underline">
            Download CSV
          </a>
          <a href="/api/admin/store-dealers?format=json" className="font-medium text-brand-700 hover:underline" target="_blank" rel="noreferrer">
            JSON
          </a>
        </div>
      </div>
      <div className="card p-6">
        <DealerForm />
      </div>
      {/* Weekly/monthly snapshot "What's new" flyer — one global announcement. */}
      <details className="card p-5" open={!flyer}>
        <summary className="cursor-pointer text-sm font-semibold text-gray-900">
          Dealer snapshot announcement (flyer)
          {flyer
            ? <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">Active</span>
            : <span className="ml-2 text-xs font-normal text-gray-400">none set</span>}
        </summary>
        <p className="mt-2 text-xs text-gray-500">
          Shown in the “What’s new in the portal” block at the bottom of the next dealer snapshot emails, until you clear it. One announcement at a time.
        </p>
        <form action={saveSnapshotFlyerAction} className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2"><span className="mb-1 block text-xs font-semibold text-gray-600">Headline</span>
            <input name="title" defaultValue={flyer?.title || ''} placeholder="The HD ID Tag Centre is live" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label>
          <label className="block sm:col-span-2"><span className="mb-1 block text-xs font-semibold text-gray-600">Blurb</span>
            <textarea name="blurb" defaultValue={flyer?.blurb || ''} rows={3} placeholder="Submit your team, send training in one click, and download their ID card — all in the portal." className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-gray-600">Button label</span>
            <input name="buttonLabel" defaultValue={flyer?.buttonLabel || ''} placeholder="See what’s changed" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-gray-600">Button link</span>
            <input name="buttonUrl" defaultValue={flyer?.buttonUrl || ''} placeholder="https://portal.ghsbarrie.ca/dealer/id-tags" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label>
          <label className="block sm:col-span-2"><span className="mb-1 block text-xs font-semibold text-gray-600">Flyer image {flyer?.imageKey ? <span className="font-normal text-green-600">(current image kept unless you upload a new one)</span> : <span className="font-normal text-gray-400">(optional)</span>}</span>
            <input name="image" type="file" accept="image/*" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-gray-700" /></label>
          <div className="sm:col-span-2">
            <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">Save announcement</button>
          </div>
        </form>
        {flyer && (
          <form action={clearSnapshotFlyerAction} className="mt-2">
            <button type="submit" className="text-xs font-semibold text-red-600 hover:underline">Clear announcement</button>
          </form>
        )}
        {flyer?.imageKey && (
          <div className="mt-3">
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-gray-400">Current image</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/api/digest/flyer-image" alt="Current flyer" className="max-h-40 rounded-lg border border-gray-200" />
          </div>
        )}
      </details>

      {/* Mobile: a card per dealer so nothing scrolls off-screen. */}
      <div className="space-y-3 sm:hidden">
        {dealers.map((d) => (
          <div key={d.id} className={`card p-4 ${d.active ? '' : 'bg-gray-50/60'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-medium text-gray-900">{d.name}</div>
                <div className="mt-0.5 text-xs text-gray-500">
                  {d._count.users} user{d._count.users === 1 ? '' : 's'} · {d._count.applications} application{d._count.applications === 1 ? '' : 's'}
                </div>
              </div>
              <span className={`badge shrink-0 ${d.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                {d.active ? 'Active' : 'Archived'}
              </span>
            </div>
            <div className="mt-3 border-t border-gray-100 pt-3">
              <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-gray-400">Journal name</div>
              <DealerJournalNameForm id={d.id} name={d.name} journalName={d.journalName} />
            </div>
            <div className="mt-3 border-t border-gray-100 pt-3">
              <DealerRowActions
                id={d.id}
                name={d.name}
                active={d.active}
                calculatorEnabled={d.calculatorEnabled}
                reportsEnabled={d.reportsEnabled}
                insightsEnabled={d.insightsEnabled}
                showPayoutsToAllUsers={d.showPayoutsToAllUsers}
                canDelete={d._count.users === 0 && d._count.applications === 0}
                align="start"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: the full table. */}
      <div className="card hidden overflow-x-auto sm:block">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Journal name</th>
              <th className="px-4 py-3">Users</th>
              <th className="px-4 py-3">Applications</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {dealers.map((d) => (
              <tr key={d.id} className={d.active ? '' : 'bg-gray-50/60'}>
                <td className="px-4 py-3 font-medium">{d.name}</td>
                <td className="px-4 py-3">
                  <DealerJournalNameForm id={d.id} name={d.name} journalName={d.journalName} />
                </td>
                <td className="px-4 py-3">{d._count.users}</td>
                <td className="px-4 py-3">{d._count.applications}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${d.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                    {d.active ? 'Active' : 'Archived'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <DealerRowActions
                    id={d.id}
                    name={d.name}
                    active={d.active}
                    calculatorEnabled={d.calculatorEnabled}
                    reportsEnabled={d.reportsEnabled}
                insightsEnabled={d.insightsEnabled}
                    showPayoutsToAllUsers={d.showPayoutsToAllUsers}
                    canDelete={d._count.users === 0 && d._count.applications === 0}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        <strong>Archive</strong> hides a dealer and blocks new sign-ins while keeping their
        history — reversible with Unarchive. <strong>Delete</strong> is permanent and only offered
        for dealers with no users and no applications, so records that reference customer data are
        never destroyed.
      </p>
    </div>
  );
}
