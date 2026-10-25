import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { IdTagStatus } from '@prisma/client';
import { requireStaffSection } from '@/lib/session';
import {
  getIdTagDetail, ID_TAG_STATUS_LABEL, ID_TAG_STATUS_TONE, TONE_CLASS,
  daysUntil, expiryTone, expiryLabel,
} from '@/lib/idTag';
import { updateIdTagStatusStaffAction, saveIdTagCardAction } from '../actions';

export const dynamic = 'force-dynamic';

const STATUS_KEYS = Object.keys(ID_TAG_STATUS_LABEL) as IdTagStatus[];

function Row({ label, children, auto }: { label: string; children: React.ReactNode; auto?: boolean }) {
  return (
    <div className="grid grid-cols-[130px_1fr] gap-x-3 gap-y-1 border-b border-slate-100 px-4 py-2.5 last:border-0">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-sm font-medium text-slate-900">
        {children}
        {auto && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">office · auto</span>}
      </dd>
    </div>
  );
}

export default async function StaffIdTagDetailPage({ params }: { params: { id: string } }) {
  await requireStaffSection('id-tags');
  const t = await getIdTagDetail(params.id);
  if (!t) notFound();

  const p = t.profile;
  const first = t.personFirst || t.personName.split(/\s+/)[0] || '';
  const last = t.personLast || t.personName.split(/\s+/).slice(1).join(' ') || '';
  const address = [
    [p.street, p.streetName].filter(Boolean).join(' '),
    p.unit ? `Unit ${p.unit}` : '',
    [p.city, p.province, p.postal].filter(Boolean).join(', '),
  ].filter(Boolean).join(', ');
  const d = daysUntil(t.validUntil);
  const validVal = t.validUntil ? new Date(t.validUntil).toISOString().slice(0, 10) : '';
  const card = 'rounded-2xl bg-white shadow-sm ring-1 ring-slate-200';
  const inp = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm';
  const lab = 'mb-1 block text-xs font-semibold text-slate-600';
  const or = <span className="text-slate-300">—</span>;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/staff/id-tags" className="text-sm font-semibold text-brand-600 hover:underline">← Back to the board</Link>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-slate-900">{t.personName}</h1>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE_CLASS[ID_TAG_STATUS_TONE[t.status]]}`}>{ID_TAG_STATUS_LABEL[t.status]}</span>
        {t.validUntil && <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE_CLASS[expiryTone(d)]}`}>{expiryLabel(d)}</span>}
        <span className="text-sm text-slate-500">{t.dealerName}</span>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[160px_1fr]">
        {/* Headshot */}
        <div>
          <div className="aspect-[3/4] overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            {t.hasHeadshot
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={`/api/id-tags/${t.id}/headshot`} alt={`${t.personName} headshot`} className="h-full w-full object-cover" />
              : <div className="flex h-full items-center justify-center p-3 text-center text-xs text-amber-600">No headshot — card will be delayed</div>}
          </div>
          {t.hasHeadshot && (
            <a href={`/api/id-tags/${t.id}/headshot`} target="_blank" rel="noreferrer"
              className="mt-2 block rounded-lg border border-slate-300 px-3 py-1.5 text-center text-xs font-semibold text-slate-700 hover:bg-slate-50">⬇ Download photo</a>
          )}
        </div>

        {/* Entuitive setup sheet */}
        <div className={card}>
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-bold text-slate-900">Entuitive setup sheet</h2>
            <p className="text-xs text-slate-500">Auto-built from the office + this person. “office · auto” fields are set once in <Link href="/staff/id-tags/setup" className="text-brand-600 hover:underline">Office setup</Link>.</p>
          </div>
          <dl>
            <Row label="First / Last">{first} {last}</Row>
            <Row label="Email (login)">{t.personEmail || or}</Row>
            <Row label="Cell phone">{t.personPhone || or}</Row>
            <Row label="Password" auto>{t.password ? <code className="rounded bg-slate-100 px-1">{t.password}</code> : <span className="text-amber-600">not set</span>}</Row>
            <Row label="Company name" auto>{p.companyName || <span className="text-amber-600">not set</span>}</Row>
            <Row label="Address" auto>{address || <span className="text-amber-600">not set</span>}</Row>
            <Row label="Office phone" auto>{[p.phone, p.ext && `ext ${p.ext}`].filter(Boolean).join(' ') || or}</Row>
            <Row label="Service" auto>{p.service || or}</Row>
            <Row label="Province" auto>{p.province || or}</Row>
            <Row label="Status / Notify" auto>Active · Primary email</Row>
            <Row label="Training">{t.certified ? <span className="font-semibold text-green-700">✓ Certified</span> : <span className="font-semibold text-red-600">✗ Needs training</span>}</Row>
          </dl>
        </div>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        {/* Status control */}
        <div className={`${card} p-5`}>
          <h2 className="text-sm font-bold text-slate-900">Status</h2>
          <form action={updateIdTagStatusStaffAction} className="mt-3 flex items-center gap-2">
            <input type="hidden" name="id" value={t.id} />
            <select name="status" defaultValue={t.status} className={inp}>
              {STATUS_KEYS.map((s) => <option key={s} value={s}>{ID_TAG_STATUS_LABEL[s]}</option>)}
            </select>
            <button type="submit" className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-900">Save</button>
          </form>
        </div>

        {/* Card: valid-until, badge #, status, upload */}
        <div className={`${card} p-5`}>
          <h2 className="text-sm font-bold text-slate-900">Entuitive card</h2>
          <form action={saveIdTagCardAction} className="mt-3 space-y-3">
            <input type="hidden" name="id" value={t.id} />
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className={lab}>Valid until</span>
                <input name="validUntil" type="date" defaultValue={validVal} className={inp} /></label>
              <label className="block"><span className={lab}>Badge #</span>
                <input name="badgeNumber" defaultValue={t.badgeNumber || ''} placeholder="1043317" className={inp} /></label>
            </div>
            <label className="block"><span className={lab}>Entuitive status</span>
              <input name="entuitiveStatus" defaultValue={t.entuitiveStatus || ''} placeholder="Approved / Approuvé" className={inp} /></label>
            <label className="block"><span className={lab}>Upload finished QR card (front + back)</span>
              <input name="card" type="file" accept="application/pdf,image/*"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-700" />
              {t.hasCard && <a href={`/api/id-tags/${t.id}/card`} className="mt-1 inline-block text-xs font-semibold text-brand-600 hover:underline">Current card uploaded — download</a>}
            </label>
            <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">Save card</button>
          </form>
        </div>
      </div>
    </div>
  );
}
