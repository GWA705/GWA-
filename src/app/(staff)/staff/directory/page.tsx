import Link from 'next/link';
import { requireStaffSection } from '@/lib/session';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function DirectoryPage({ searchParams }: { searchParams: { q?: string } }) {
  const user = await requireStaffSection('directory');
  const canEdit = user.role === 'ADMIN';
  const q = (searchParams.q ?? '').trim();

  const dealers = await prisma.dealer.findMany({
    where: {
      active: true,
      ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
    },
    orderBy: { name: 'asc' },
    include: { profile: true },
  });

  const withProfile = dealers.filter((d) => d.profile);
  const missing = dealers.filter((d) => !d.profile);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Office directory</h1>
          <p className="mt-1 text-sm text-gray-500">
            Locations and key contacts, kept up to date by each office.
            {canEdit ? ' You can edit any profile.' : ' Read-only.'}
          </p>
        </div>
        <form className="flex items-center gap-2" action="/staff/directory">
          <input name="q" defaultValue={q} placeholder="Search office name…" className="input h-9 w-56 text-sm" />
          <button type="submit" className="btn-secondary text-sm">Search</button>
        </form>
      </div>

      {dealers.length === 0 ? (
        <div className="card p-8 text-center text-sm text-gray-500">No offices found.</div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {withProfile.map((d) => {
            const p = d.profile!;
            return (
              <li key={d.id} className="card p-5">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">{p.businessName || d.name}</h2>
                    {p.website && <a href={p.website} target="_blank" rel="noreferrer" className="text-xs text-brand-700 hover:underline">{p.website}</a>}
                  </div>
                  {canEdit && (
                    <Link href={`/staff/directory/${d.id}`} className="btn-secondary text-xs">Edit</Link>
                  )}
                </div>
                <dl className="space-y-1.5 text-sm text-gray-700">
                  {p.address && <Row label="Address">{p.address}</Row>}
                  {p.shippingAddress && <Row label="Shipping">{p.shippingAddress}</Row>}
                  {(p.phone || p.altPhone) && <Row label="Phone">{[p.phone, p.altPhone].filter(Boolean).join(' · ')}</Row>}
                  {p.officeHours && <Row label="Hours">{p.officeHours}</Row>}
                  {(p.billingContactName || p.billingPhone || p.billingEmail) && (
                    <Row label="Billing">
                      {[p.billingContactName, p.billingPhone, p.billingEmail].filter(Boolean).join(' · ')}
                    </Row>
                  )}
                  {(p.supportContactName || p.supportPhone || p.supportEmail) && (
                    <Row label="Support">
                      {[p.supportContactName, p.supportPhone, p.supportEmail].filter(Boolean).join(' · ')}
                    </Row>
                  )}
                </dl>
              </li>
            );
          })}
        </ul>
      )}

      {missing.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            No profile yet ({missing.length})
          </h2>
          <ul className="flex flex-wrap gap-2">
            {missing.map((d) => (
              <li key={d.id}>
                {canEdit ? (
                  <Link href={`/staff/directory/${d.id}`} className="badge bg-gray-100 text-gray-600 hover:bg-gray-200">
                    {d.name} — add
                  </Link>
                ) : (
                  <span className="badge bg-gray-100 text-gray-500">{d.name}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-16 flex-none text-gray-400">{label}</dt>
      <dd className="min-w-0 whitespace-pre-wrap break-words">{children}</dd>
    </div>
  );
}
