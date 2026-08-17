import Link from 'next/link';
import { requireStaffSection } from '@/lib/session';
import { prisma } from '@/lib/db';
import { formatPhoneDisplay } from '@/lib/format';
import { readExtraContacts, DEFAULT_BILLING_LABEL, DEFAULT_SUPPORT_LABEL } from '@/lib/dealerProfile';

export const dynamic = 'force-dynamic';

const telHref = (v: string) => {
  const d = v.replace(/\D/g, '');
  return `tel:+${d.length === 10 ? '1' + d : d}`;
};
const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';

function Logo({ dealerId, hasLogo, name, v }: { dealerId: string; hasLogo: boolean; name: string; v: number }) {
  if (hasLogo) {
    return (
      <div className="flex h-14 w-14 flex-none items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/dealer-profiles/${dealerId}/logo?v=${v}`} alt="" className="h-full w-full object-contain" />
      </div>
    );
  }
  return (
    <div className="flex h-14 w-14 flex-none items-center justify-center rounded-xl bg-brand-100 text-lg font-bold text-brand-700">
      {initials(name)}
    </div>
  );
}

// One labelled contact person (billing / support).
function ContactBlock({ label, name, phone, email }: { label: string; name?: string | null; phone?: string | null; email?: string | null }) {
  if (!name && !phone && !email) return null;
  return (
    <div className="rounded-lg bg-gray-50 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</div>
      {name && <div className="text-sm font-medium text-gray-800">{name}</div>}
      <div className="mt-0.5 space-y-0.5 text-sm">
        {phone && <div><a href={telHref(phone)} className="text-brand-700 hover:underline">{formatPhoneDisplay(phone)}</a></div>}
        {email && email.split(',').map((e) => e.trim()).filter(Boolean).map((e) => (
          <div key={e}><a href={`mailto:${e}`} className="break-all text-brand-700 hover:underline">{e}</a></div>
        ))}
      </div>
    </div>
  );
}

function InfoRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5 text-sm text-gray-700">
      <span className="mt-0.5 flex-none text-gray-400" aria-hidden>{icon}</span>
      <span className="min-w-0 whitespace-pre-wrap break-words">{children}</span>
    </div>
  );
}

const I = {
  pin: <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 21s7-5.686 7-11a7 7 0 1 0-14 0c0 5.314 7 11 7 11Z" stroke="currentColor" strokeWidth="1.6"/><circle cx="12" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.6"/></svg>,
  truck: <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M3 6h11v9H3zM14 9h4l3 3v3h-7z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><circle cx="7" cy="17" r="1.6" stroke="currentColor" strokeWidth="1.6"/><circle cx="17.5" cy="17" r="1.6" stroke="currentColor" strokeWidth="1.6"/></svg>,
  phone: <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M5 4h3l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5V19a2 2 0 0 1-2 2A16 16 0 0 1 4 6a2 2 0 0 1 1-2Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>,
  clock: <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6"/><path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>,
};

export default async function DirectoryPage({ searchParams }: { searchParams: { q?: string } }) {
  const user = await requireStaffSection('directory');
  const canEdit = user.role === 'ADMIN';
  const q = (searchParams.q ?? '').trim();

  const dealers = await prisma.dealer.findMany({
    where: { active: true, ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}) },
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
            Locations and key contacts, kept up to date by each office.{canEdit ? ' You can edit any profile.' : ' Read-only.'}
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
        <ul className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {withProfile.map((d) => {
            const p = d.profile!;
            const phones = [p.phone, p.altPhone].filter(Boolean) as string[];
            return (
              <li key={d.id} className="card overflow-hidden p-0">
                <div className="flex items-start gap-4 border-b border-gray-100 p-5">
                  <Logo dealerId={d.id} hasLogo={!!p.logoStorageKey} name={p.businessName || d.name} v={p.updatedAt.getTime()} />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-base font-semibold text-gray-900">{p.businessName || d.name}</h2>
                    {p.website && (
                      <a href={p.website.startsWith('http') ? p.website : `https://${p.website}`} target="_blank" rel="noreferrer" className="break-all text-sm text-brand-700 hover:underline">
                        {p.website.replace(/^https?:\/\//, '')}
                      </a>
                    )}
                  </div>
                  {canEdit && <Link href={`/staff/directory/${d.id}`} className="btn-secondary flex-none text-xs">Edit</Link>}
                </div>

                <div className="space-y-2.5 p-5">
                  {p.address && <InfoRow icon={I.pin}>{p.address}</InfoRow>}
                  {p.shippingAddress && <InfoRow icon={I.truck}><span className="text-gray-400">Ship: </span>{p.shippingAddress}</InfoRow>}
                  {phones.length > 0 && (
                    <InfoRow icon={I.phone}>
                      {phones.map((ph, i) => (
                        <span key={i}>{i > 0 && ' · '}<a href={telHref(ph)} className="text-brand-700 hover:underline">{formatPhoneDisplay(ph)}</a></span>
                      ))}
                    </InfoRow>
                  )}
                  {p.officeHours && <InfoRow icon={I.clock}>{p.officeHours}</InfoRow>}
                </div>

                {(() => {
                  const extras = readExtraContacts(p.extraContacts);
                  const hasBilling = !!(p.billingContactName || p.billingPhone || p.billingEmail);
                  const hasSupport = !!(p.supportContactName || p.supportPhone || p.supportEmail);
                  if (!hasBilling && !hasSupport && extras.length === 0) return null;
                  return (
                    <div className="grid grid-cols-1 gap-3 px-5 pb-5 sm:grid-cols-2">
                      <ContactBlock label={p.billingLabel || DEFAULT_BILLING_LABEL} name={p.billingContactName} phone={p.billingPhone} email={p.billingEmail} />
                      <ContactBlock label={p.supportLabel || DEFAULT_SUPPORT_LABEL} name={p.supportContactName} phone={p.supportPhone} email={p.supportEmail} />
                      {extras.map((c, i) => (
                        <ContactBlock key={i} label={c.role || 'Contact'} name={c.name} phone={c.phone} email={c.email} />
                      ))}
                    </div>
                  );
                })()}
              </li>
            );
          })}
        </ul>
      )}

      {missing.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">No profile yet ({missing.length})</h2>
          <ul className="flex flex-wrap gap-2">
            {missing.map((d) => (
              <li key={d.id}>
                {canEdit ? (
                  <Link href={`/staff/directory/${d.id}`} className="badge bg-gray-100 text-gray-600 hover:bg-gray-200">{d.name} — add</Link>
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
