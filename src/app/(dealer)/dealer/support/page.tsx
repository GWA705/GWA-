import { requireDealerAccess } from '@/lib/session';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function DealerSupportPage() {
  await requireDealerAccess();
  const contacts = await prisma.supportContact.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Contact &amp; Support</h1>
        <p className="mt-1 text-sm text-gray-600">Reach the right people at GWA. Save these for quick reference.</p>
      </div>

      {contacts.length === 0 ? (
        <div className="card p-8 text-center text-sm text-gray-500">Contact details will appear here soon.</div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {contacts.map((c) => (
            <li key={c.id} className="card p-5">
              <h2 className="text-base font-semibold text-gray-900">{c.name}</h2>
              {c.title && <p className="text-xs uppercase tracking-wide text-gray-400">{c.title}</p>}
              <dl className="mt-3 space-y-1.5 text-sm">
                {c.phone && (
                  <div className="flex gap-2">
                    <dt className="w-14 flex-none text-gray-400">Phone</dt>
                    <dd><a href={`tel:${c.phone.replace(/[^\d+]/g, '')}`} className="text-brand-700 hover:underline">{c.phone}</a>{c.altPhone && <> · <a href={`tel:${c.altPhone.replace(/[^\d+]/g, '')}`} className="text-brand-700 hover:underline">{c.altPhone}</a></>}</dd>
                  </div>
                )}
                {c.email && (
                  <div className="flex gap-2">
                    <dt className="w-14 flex-none text-gray-400">Email</dt>
                    <dd><a href={`mailto:${c.email}`} className="break-all text-brand-700 hover:underline">{c.email}</a></dd>
                  </div>
                )}
                {c.hours && (
                  <div className="flex gap-2">
                    <dt className="w-14 flex-none text-gray-400">Hours</dt>
                    <dd className="whitespace-pre-wrap text-gray-700">{c.hours}</dd>
                  </div>
                )}
                {c.website && (
                  <div className="flex gap-2">
                    <dt className="w-14 flex-none text-gray-400">Web</dt>
                    <dd><a href={c.website} target="_blank" rel="noreferrer" className="break-all text-brand-700 hover:underline">{c.website}</a></dd>
                  </div>
                )}
              </dl>
              {c.notes && <p className="mt-3 whitespace-pre-wrap border-t border-gray-100 pt-3 text-sm text-gray-600">{c.notes}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
