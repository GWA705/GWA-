import { requireAdminSection } from '@/lib/session';
import { prisma } from '@/lib/db';
import { getSetting } from '@/lib/settings';
import { ONBOARD_CODE_KEY, portalBaseUrl } from '@/lib/onboard';
import { resolveOnboardRequestAction, attachOnboardToDealerAction, backfillProfileFromIntakeAction } from '@/app/(admin)/actions';
import { ItemActions } from './ItemActions';
import { OnboardCodeForm } from './OnboardCodeForm';

export const dynamic = 'force-dynamic';

type OnboardPerson = { name?: string; email?: string; phone?: string; jobTitle?: string; isMainContact?: boolean };

const ITEM_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  CREATED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-gray-100 text-gray-600',
};
const ITEM_LABEL: Record<string, string> = {
  PENDING: 'Awaiting decision',
  CREATED: 'Login created',
  REJECTED: 'Declined',
};

export default async function AdminUserRequestsPage() {
  await requireAdminSection('user-requests');
  const requests = await prisma.userRequest.findMany({
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    include: {
      dealer: { select: { name: true } },
      submittedBy: { select: { name: true, email: true } },
      items: { orderBy: { createdAt: 'asc' } },
    },
    take: 100,
  });

  const pending = requests.filter((r) => r.status === 'PENDING');
  const done = requests.filter((r) => r.status !== 'PENDING');
  const pendingPeople = pending.reduce((n, r) => n + r.items.filter((i) => i.status === 'PENDING').length, 0);

  // New-dealer intake (public link) — the shareable link, current code, and requests.
  const [onboardCode, onboardRequests, activeDealers] = await Promise.all([
    getSetting(ONBOARD_CODE_KEY),
    prisma.onboardRequest.findMany({ orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], take: 100 }),
    prisma.dealer.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);
  const onboardNew = onboardRequests.filter((r) => r.status === 'NEW');
  const intakeLink = `${portalBaseUrl()}/request-access`;

  function OnboardCard({ r }: { r: (typeof onboardRequests)[number] }) {
    const people = (Array.isArray(r.people) ? r.people : []) as OnboardPerson[];
    return (
      <li className="card p-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            {r.logoStorageKey && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={`/api/onboard/${r.id}/logo`} alt="" className="h-12 w-12 shrink-0 rounded object-contain ring-1 ring-gray-200" />
            )}
            <div>
              <h3 className="text-base font-semibold text-gray-900">{r.company}</h3>
              {r.legalName && <p className="text-xs text-gray-500">Legal name: {r.legalName}</p>}
              <p className="text-xs text-gray-400">Sent {r.createdAt.toLocaleString('en-CA')}</p>
            </div>
          </div>
          <span className="text-xs text-gray-400">{people.length} {people.length === 1 ? 'person' : 'people'}</span>
        </div>

        <dl className="mb-3 grid grid-cols-1 gap-x-6 gap-y-1 rounded-lg bg-gray-50 p-3 text-xs text-gray-600 sm:grid-cols-2">
          <div><dt className="inline font-semibold text-gray-500">Main contact: </dt><dd className="inline">{r.contactName}{r.phone ? ` · ${r.phone}` : ''} · <span className="break-all">{r.email}</span></dd></div>
          {(r.officePhone || r.officeEmail) && (
            <div><dt className="inline font-semibold text-gray-500">Office: </dt><dd className="inline">{r.officePhone || ''}{r.officePhone && r.officeEmail ? ' · ' : ''}<span className="break-all">{r.officeEmail || ''}</span></dd></div>
          )}
          {(r.address || r.city || r.province || r.postal) && (
            <div className="sm:col-span-2"><dt className="inline font-semibold text-gray-500">Address: </dt><dd className="inline">{[r.address, r.city, r.province, r.postal].filter(Boolean).join(', ')}</dd></div>
          )}
          {r.mailingAddress && (
            <div className="sm:col-span-2"><dt className="inline font-semibold text-gray-500">Mailing: </dt><dd className="inline whitespace-pre-wrap">{r.mailingAddress}</dd></div>
          )}
        </dl>
        {r.note && <p className="mb-2 rounded bg-gray-50 p-2 text-xs text-gray-600">Note: {r.note}</p>}
        <ul className="divide-y divide-gray-100">
          {people.map((p, i) => (
            <li key={i} className="py-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-gray-900">{p.name || '(no name)'}</span>
                {p.isMainContact && <span className="badge bg-brand-50 text-brand-700">Owner / main contact</span>}
              </div>
              <div className="break-all text-gray-600">{p.email}</div>
              <div className="text-xs text-gray-400">{p.phone ? `${p.phone} · ` : ''}{p.jobTitle || 'No job title'}</div>
            </li>
          ))}
        </ul>
        {r.status === 'NEW' ? (
          <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
            <form action={attachOnboardToDealerAction.bind(null, r.id)} className="space-y-2">
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label className="label text-xs">Attach to dealer</label>
                  <select name="dealerId" required defaultValue="" className="input w-56 text-sm">
                    <option value="" disabled>Choose the right dealer…</option>
                    {activeDealers.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="btn-primary text-xs">Attach &amp; create request</button>
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-600">
                <input type="checkbox" name="fillProfile" defaultChecked className="h-3.5 w-3.5 rounded border-gray-300" />
                Also fill the office directory — address, phone, logo &amp; each person as a contact card
              </label>
            </form>
            <p className="text-xs text-gray-400">
              Sends this office&rsquo;s people into the approval queue under the dealer you pick. With the box ticked it also
              builds that office&rsquo;s <a href="/staff/directory" className="text-brand-700 hover:underline">directory profile</a>{' '}
              from the intake (safe to re-run — it only fills blanks and adds new people, never overwrites). New dealer? Create it under{' '}
              <a href="/admin/dealers" className="text-brand-700 hover:underline">Dealers</a> first, then attach.
            </p>
            <div className="flex gap-2">
              <form action={resolveOnboardRequestAction.bind(null, r.id, 'HANDLED')}>
                <button type="submit" className="btn-secondary text-xs">Mark handled (no request)</button>
              </form>
              <form action={resolveOnboardRequestAction.bind(null, r.id, 'DISMISSED')}>
                <button type="submit" className="btn-secondary text-xs">Dismiss</button>
              </form>
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
            <span className={`badge ${r.status === 'HANDLED' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
              {r.status === 'HANDLED' ? 'Handled' : 'Dismissed'}
            </span>
            <form action={backfillProfileFromIntakeAction.bind(null, r.id)} className="flex flex-wrap items-end gap-2">
              <div>
                <label className="label text-xs">Fill office directory from this intake</label>
                <select name="dealerId" required defaultValue={r.attachedDealerId ?? ''} className="input w-56 text-sm">
                  <option value="" disabled>Choose the office…</option>
                  {activeDealers.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn-secondary text-xs">Fill directory</button>
            </form>
            <p className="text-xs text-gray-400">
              Builds/refreshes the office&rsquo;s <a href="/staff/directory" className="text-brand-700 hover:underline">directory profile</a>{' '}
              from this intake — only fills blanks and adds new people, never overwrites.
            </p>
          </div>
        )}
      </li>
    );
  }

  function Card({ req }: { req: (typeof requests)[number] }) {
    return (
      <li className="card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-gray-900">{req.dealer.name}</h3>
            <p className="text-xs text-gray-500">
              Requested {req.createdAt.toLocaleString('en-CA')} by {req.submittedBy.name} ({req.submittedBy.email})
            </p>
          </div>
          <span className="text-xs text-gray-400">{req.items.length} {req.items.length === 1 ? 'person' : 'people'}</span>
        </div>
        {req.note && <p className="mb-3 rounded bg-gray-50 p-2 text-xs text-gray-600">Note: {req.note}</p>}
        <ul className="divide-y divide-gray-100">
          {req.items.map((it) => (
            <li key={it.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-gray-900">{it.name}</span>
                  {it.isMainContact && <span className="badge bg-brand-50 text-brand-700">Owner / main contact</span>}
                </div>
                <div className="mt-0.5 break-all text-sm text-gray-600">{it.email}</div>
                <div className="text-xs text-gray-400">
                  {it.phone ? `${it.phone} · ` : ''}{it.jobTitle || 'No job title'}
                </div>
              </div>
              <div className="flex-none">
                {it.status === 'PENDING' ? (
                  <ItemActions itemId={it.id} email={it.email} />
                ) : (
                  <div className="text-right">
                    <span className={`badge ${ITEM_BADGE[it.status]}`}>{ITEM_LABEL[it.status]}</span>
                    {it.status === 'REJECTED' && it.rejectReason && (
                      <div className="mt-1 text-xs text-gray-400">{it.rejectReason}</div>
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </li>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">User requests</h1>
        <p className="mt-1 text-sm text-gray-500">
          Logins dealers have asked GWA to create. Approving a person creates their dealer login
          (temporary password, must change at first sign-in) on the requesting dealership.
        </p>
      </div>

      <OnboardCodeForm link={intakeLink} currentCode={onboardCode ?? ''} />

      {onboardNew.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-800">
            New dealer requests <span className="ml-1 rounded-full bg-brand-600 px-2 py-0.5 text-xs text-white">{onboardNew.length}</span>
          </h2>
          <ul className="space-y-4">
            {onboardNew.map((r) => <OnboardCard key={r.id} r={r} />)}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-800">
          Waiting on you {pendingPeople > 0 && <span className="ml-1 rounded-full bg-brand-600 px-2 py-0.5 text-xs text-white">{pendingPeople}</span>}
        </h2>
        {pending.length === 0 ? (
          <div className="card p-8 text-center text-sm text-gray-500">No pending requests. 🎉</div>
        ) : (
          <ul className="space-y-4">
            {pending.map((req) => <Card key={req.id} req={req} />)}
          </ul>
        )}
      </section>

      {done.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Handled</h2>
          <ul className="space-y-4">
            {done.map((req) => <Card key={req.id} req={req} />)}
          </ul>
        </section>
      )}

      {onboardRequests.some((r) => r.status !== 'NEW') && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Past new-dealer requests</h2>
          <ul className="space-y-4">
            {onboardRequests.filter((r) => r.status !== 'NEW').map((r) => <OnboardCard key={r.id} r={r} />)}
          </ul>
        </section>
      )}
    </div>
  );
}
