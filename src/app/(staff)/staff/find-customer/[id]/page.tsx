import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { prisma } from '@/lib/db';
import { isGlobalSearchEnabled } from '@/lib/settings';
import { canSearchAllCustomers } from '@/lib/customerSearch';
import { matchManualsForProducts } from '@/lib/resourceMatch';
import { readExtraContacts, DEFAULT_BILLING_LABEL, DEFAULT_SUPPORT_LABEL } from '@/lib/dealerProfile';
import { formatPhoneDisplay } from '@/lib/format';
import { STATUS_LABELS } from '@/lib/constants';
import { getOverride, appOverrideKey, overlay } from '@/lib/customerOverride';
import { decryptOptional } from '@/lib/crypto';
import { MessageOffice } from '../MessageOffice';
import { EditCustomerContact } from '../EditCustomerContact';
import { DocViewer } from '@/components/DocViewer';

export const dynamic = 'force-dynamic';

export default async function CustomerAssistPage({ params }: { params: { id: string } }) {
  const user = await requireRole('REVIEWER', 'ADMIN');
  if (!(await isGlobalSearchEnabled()) || !(await canSearchAllCustomers(user))) notFound();

  const app = await prisma.application.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      applicantFirstName: true,
      applicantLastName: true,
      applicantPhone: true,
      applicantEmail: true,
      applicantAddressEnc: true,
      province: true,
      status: true,
      productsSold: true,
      hdReference: true,
      financeItNumber: true,
      dateOfSale: true,
      datePaid: true,
      dealer: {
        select: {
          name: true,
          profile: {
            select: {
              businessName: true, phone: true, altPhone: true, supportLabel: true, supportContactName: true, supportPhone: true,
              supportEmail: true, billingLabel: true, billingContactName: true, billingPhone: true, billingEmail: true,
              extraContacts: true, address: true, officeHours: true, website: true,
            },
          },
        },
      },
    },
  });
  if (!app) notFound();

  // Overlay any saved contact correction (the original application is untouched).
  const ov = await getOverride(appOverrideKey(app.id));
  const origAddress = decryptOptional(app.applicantAddressEnc) ?? '';
  const effPhone = overlay(app.applicantPhone ?? '', ov?.phone);
  const effEmail = overlay(app.applicantEmail ?? '', ov?.email);
  const effAddress = overlay(origAddress, ov?.address);

  const manuals = await matchManualsForProducts(app.productsSold);
  const p = app.dealer?.profile ?? null;
  const officeName = p?.businessName || app.dealer?.name || 'their office';
  const officePhone = p?.phone || p?.supportPhone || null;
  const officeContacts = readExtraContacts(p?.extraContacts);

  return (
    <div className="max-w-3xl space-y-5">
      <Link href="/staff/find-customer" className="text-sm text-gray-500 hover:underline">← Back to search</Link>

      {/* Customer header */}
      <div className="overflow-hidden rounded-2xl shadow-sm" style={{ background: 'linear-gradient(135deg,#16233a,#26436a)' }}>
        <div className="flex flex-wrap items-start justify-between gap-3 p-6 text-white">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/50">GWA · Customer</div>
            <h1 className="mt-1 text-2xl font-bold leading-tight">{app.applicantFirstName} {app.applicantLastName}</h1>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/70">
              {effPhone && <span>📞 <a href={`tel:${effPhone.replace(/[^0-9+]/g, '')}`} className="font-medium text-white hover:underline">{formatPhoneDisplay(effPhone)}</a></span>}
              {effEmail && <span>✉️ {effEmail}</span>}
              <span>{app.province}</span>
            </div>
          </div>
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold text-white">{STATUS_LABELS[app.status]}</span>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-white/10 px-6 py-2.5 text-xs text-white/60">
          {app.dateOfSale && <span>🗓 Sold {app.dateOfSale.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
          {app.hdReference && <span>HD #{app.hdReference}</span>}
          {app.financeItNumber && <span>Loan #{app.financeItNumber}</span>}
          <Link href={`/staff/applications/${app.id}`} className="ml-auto font-medium text-sky-300 hover:underline">Open full deal →</Link>
        </div>
      </div>

      {/* Editable customer contact (stored as a correction; original untouched) */}
      <EditCustomerContact
        applicationId={app.id}
        customerName={`${app.applicantFirstName} ${app.applicantLastName}`.trim()}
        initial={{ phone: effPhone, address: effAddress, email: effEmail }}
        updatedAt={ov?.updatedAt ? ov.updatedAt.toISOString() : null}
        updatedByName={ov?.updatedByName ?? null}
      />

      {/* What they bought */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">What they bought</h2>
        {app.productsSold.length === 0 ? (
          <p className="text-sm text-gray-500">No products recorded on this deal.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {app.productsSold.map((name) => (
              <span key={name} className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-800">{name}</span>
            ))}
          </div>
        )}
      </section>

      {/* Manuals & info */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-gray-900">Manuals &amp; product info</h2>
        {manuals.length === 0 ? (
          <p className="text-sm text-gray-500">
            No matching manuals in the Resource library yet.{' '}
            <Link href="/admin/resource-library" className="text-sky-600 hover:underline">Add product docs →</Link>
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {manuals.map((m) => (
              <div key={m.productId} className="flex gap-3 rounded-lg border border-gray-100 p-3">
                {m.hasImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/resource-products/${m.productId}/image`} alt="" className="h-14 w-14 shrink-0 rounded object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-gray-900">{m.title}{m.brand ? ` · ${m.brand}` : ''}</div>
                  {m.files.length === 0 ? (
                    <p className="text-xs text-gray-400">No files attached.</p>
                  ) : (
                    <div className="mt-1 flex flex-wrap gap-2">
                      {m.files.map((f) => (
                        <DocViewer
                          key={f.id}
                          id={f.id}
                          fileName={f.label}
                          mimeType={f.mime}
                          src={`/api/resource-files/${f.id}`}
                          title={`${f.kindLabel}: ${f.label}`}
                          className="rounded-md bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100"
                        >
                          {f.kindLabel}: {f.label} ↗
                        </DocViewer>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Local office */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Their local office</h2>
        <div className="text-sm text-gray-700">
          <div className="text-base font-semibold text-gray-900">{officeName}</div>
          <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
            {officePhone && <div>Phone: <span className="font-medium text-gray-900">{formatPhoneDisplay(officePhone)}</span></div>}
            {p?.supportContactName && <div>{p.supportLabel || DEFAULT_SUPPORT_LABEL}: {p.supportContactName}{p.supportPhone ? ` · ${formatPhoneDisplay(p.supportPhone)}` : ''}{p.supportEmail ? ` · ${p.supportEmail}` : ''}</div>}
            {p?.billingContactName && <div>{p.billingLabel || DEFAULT_BILLING_LABEL}: {p.billingContactName}{p.billingPhone ? ` · ${formatPhoneDisplay(p.billingPhone)}` : ''}{p.billingEmail ? ` · ${p.billingEmail}` : ''}</div>}
            {p?.officeHours && <div>Hours: {p.officeHours}</div>}
            {p?.address && <div className="sm:col-span-2">Address: {p.address}</div>}
            {p?.website && <div className="sm:col-span-2">Web: {p.website}</div>}
          </div>
          {officeContacts.length > 0 && (
            <div className="mt-3 border-t border-gray-100 pt-3">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Other contacts</div>
              <div className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
                {officeContacts.map((c, i) => (
                  <div key={i}>
                    <span className="font-medium text-gray-900">{c.name || '—'}</span>
                    {c.role && <span className="text-gray-500"> · {c.role}</span>}
                    {c.phone && <span> · <a href={`tel:${c.phone.replace(/[^0-9+]/g, '')}`} className="text-brand-700 hover:underline">{formatPhoneDisplay(c.phone)}</a></span>}
                    {c.email && <span> · <a href={`mailto:${c.email}`} className="text-brand-700 hover:underline">{c.email}</a></span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {!p && <p className="mt-1 text-xs text-gray-400">This office hasn&apos;t filled in its profile yet.</p>}
        </div>
      </section>

      {/* Message the office */}
      <section className="rounded-2xl border border-sky-200 bg-sky-50 p-5 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-sky-900">Message the office about this call</h2>
        <p className="mb-3 text-xs text-sky-700">
          Leave a note about the customer&apos;s call. It&apos;s saved on the deal and the office is notified.
        </p>
        <MessageOffice applicationId={app.id} officeName={officeName} />
      </section>
    </div>
  );
}
