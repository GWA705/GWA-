import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { prisma } from '@/lib/db';
import { isGlobalSearchEnabled } from '@/lib/settings';
import { canSearchAllCustomers } from '@/lib/customerSearch';
import { matchManualsForProducts } from '@/lib/resourceMatch';
import { formatPhoneDisplay } from '@/lib/format';
import { STATUS_LABELS } from '@/lib/constants';
import { MessageOffice } from '../MessageOffice';

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
      province: true,
      status: true,
      productsSold: true,
      hdReference: true,
      financeItNumber: true,
      dealer: {
        select: {
          name: true,
          profile: {
            select: {
              businessName: true, phone: true, altPhone: true, supportContactName: true, supportPhone: true,
              supportEmail: true, billingContactName: true, address: true, officeHours: true, website: true,
            },
          },
        },
      },
    },
  });
  if (!app) notFound();

  const manuals = await matchManualsForProducts(app.productsSold);
  const p = app.dealer?.profile ?? null;
  const officeName = p?.businessName || app.dealer?.name || 'their office';
  const officePhone = p?.phone || p?.supportPhone || null;

  return (
    <div className="max-w-3xl space-y-5">
      <Link href="/staff/find-customer" className="text-sm text-gray-500 hover:underline">← Back to search</Link>

      {/* Customer header */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex flex-wrap items-start justify-between gap-3 p-5">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{app.applicantFirstName} {app.applicantLastName}</h1>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
              {app.applicantPhone && <span>📞 <a href={`tel:${app.applicantPhone.replace(/[^0-9+]/g, '')}`} className="font-medium text-gray-900 hover:underline">{formatPhoneDisplay(app.applicantPhone)}</a></span>}
              {app.applicantEmail && <span>✉️ {app.applicantEmail}</span>}
              <span>{app.province}</span>
            </div>
          </div>
          <span className="badge bg-gray-100 text-gray-700">{STATUS_LABELS[app.status]}</span>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-gray-100 bg-gray-50 px-5 py-2 text-xs text-gray-500">
          {app.hdReference && <span>HD #{app.hdReference}</span>}
          {app.financeItNumber && <span>Loan #{app.financeItNumber}</span>}
          <Link href={`/staff/applications/${app.id}`} className="ml-auto font-medium text-sky-600 hover:underline">Open full deal →</Link>
        </div>
      </div>

      {/* What they bought */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
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
      <section className="rounded-xl border border-gray-200 bg-white p-5">
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
                        <a key={f.id} href={`/api/resource-files/${f.id}`} target="_blank" rel="noopener noreferrer" className="rounded-md bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100">
                          {f.kindLabel}: {f.label} ↗
                        </a>
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
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Their local office</h2>
        <div className="text-sm text-gray-700">
          <div className="text-base font-semibold text-gray-900">{officeName}</div>
          <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
            {officePhone && <div>Phone: <span className="font-medium text-gray-900">{formatPhoneDisplay(officePhone)}</span></div>}
            {p?.supportContactName && <div>Support contact: {p.supportContactName}{p.supportPhone ? ` · ${formatPhoneDisplay(p.supportPhone)}` : ''}</div>}
            {p?.billingContactName && <div>Billing contact: {p.billingContactName}</div>}
            {p?.officeHours && <div>Hours: {p.officeHours}</div>}
            {p?.address && <div className="sm:col-span-2">Address: {p.address}</div>}
            {p?.website && <div className="sm:col-span-2">Web: {p.website}</div>}
          </div>
          {!p && <p className="mt-1 text-xs text-gray-400">This office hasn&apos;t filled in its profile yet.</p>}
        </div>
      </section>

      {/* Message the office */}
      <section className="rounded-xl border border-sky-200 bg-sky-50 p-5">
        <h2 className="mb-1 text-sm font-semibold text-sky-900">Message the office about this call</h2>
        <p className="mb-3 text-xs text-sky-700">
          Leave a note about the customer&apos;s call. It&apos;s saved on the deal and the office is notified.
        </p>
        <MessageOffice applicationId={app.id} officeName={officeName} />
      </section>
    </div>
  );
}
