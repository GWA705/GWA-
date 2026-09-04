import { requireDealerAccess } from '@/lib/session';
import { prisma } from '@/lib/db';
import { formatPhoneDisplay } from '@/lib/format';
import { SectionHero } from '@/components/SectionHero';

export const dynamic = 'force-dynamic';

const telHref = (v: string) => {
  const d = v.replace(/\D/g, '');
  return `tel:+${d.length === 10 ? '1' + d : d}`;
};
const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';

const I = {
  phone: <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M5 4h3l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5V19a2 2 0 0 1-2 2A16 16 0 0 1 4 6a2 2 0 0 1 1-2Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>,
  mail: <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6"/><path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.6"/></svg>,
  clock: <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6"/><path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>,
  web: <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6"/><path d="M3.5 12h17M12 3.5c2.5 2.4 2.5 14.6 0 17M12 3.5c-2.5 2.4-2.5 14.6 0 17" stroke="currentColor" strokeWidth="1.6"/></svg>,
};

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5 text-sm">
      <span className="mt-0.5 flex-none text-gray-400" aria-hidden>{icon}</span>
      <span className="min-w-0 whitespace-pre-wrap break-words text-gray-700">{children}</span>
    </div>
  );
}

export default async function DealerSupportPage() {
  await requireDealerAccess();
  const contacts = await prisma.supportContact.findMany({
    where: { active: true },
    orderBy: [{ name: 'asc' }],
  });
  // Alphabetical by name, case-insensitively (so "JJ" sorts with the j's).
  contacts.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <SectionHero
        eyebrow="Help"
        title="Contact & Support"
        subtitle="Reach the right people at Georgian Water & Air. Tap a number to call or an email to write."
        flourish={['Here', 'To', 'Help.']}
      />

      {contacts.length === 0 ? (
        <div className="card p-8 text-center text-sm text-gray-500">Contact details will appear here soon.</div>
      ) : (
        <ul className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {contacts.map((c) => (
            <li key={c.id} className="card overflow-hidden p-0">
              <div className="flex items-start gap-4 border-b border-gray-100 p-5">
                {c.logoStorageKey ? (
                  <div className="flex h-14 w-14 flex-none items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/support-contacts/${c.id}/logo?v=${c.updatedAt.getTime()}`} alt="" className="h-full w-full object-contain" />
                  </div>
                ) : (
                  <div className="flex h-14 w-14 flex-none items-center justify-center rounded-xl bg-brand-100 text-lg font-bold text-brand-700">
                    {initials(c.name)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-semibold text-gray-900">{c.name}</h2>
                  {c.title && <p className="text-xs uppercase tracking-wide text-gray-400">{c.title}</p>}
                </div>
              </div>

              <div className="space-y-2.5 p-5">
                {c.phone && (
                  <Row icon={I.phone}>
                    <a href={telHref(c.phone)} className="text-brand-700 hover:underline">{formatPhoneDisplay(c.phone)}</a>
                    {c.altPhone && <> · <a href={telHref(c.altPhone)} className="text-brand-700 hover:underline">{formatPhoneDisplay(c.altPhone)}</a></>}
                  </Row>
                )}
                {c.email && (
                  <Row icon={I.mail}>
                    {c.email.split(',').map((e) => e.trim()).filter(Boolean).map((e, i) => (
                      <span key={e}>
                        {i > 0 && <span className="text-gray-400"> · </span>}
                        <a href={`mailto:${e}`} className="break-all text-brand-700 hover:underline">{e}</a>
                      </span>
                    ))}
                  </Row>
                )}
                {c.hours && <Row icon={I.clock}>{c.hours}</Row>}
                {c.website && (
                  <Row icon={I.web}>
                    <a href={c.website.startsWith('http') ? c.website : `https://${c.website}`} target="_blank" rel="noreferrer" className="break-all text-brand-700 hover:underline">
                      {c.website.replace(/^https?:\/\//, '')}
                    </a>
                  </Row>
                )}
                {c.notes && <p className="whitespace-pre-wrap border-t border-gray-100 pt-3 text-sm text-gray-600">{c.notes}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
