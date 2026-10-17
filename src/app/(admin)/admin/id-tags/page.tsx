import Link from 'next/link';
import type { IdTagStatus } from '@prisma/client';
import { requireAdminSection } from '@/lib/session';
import { prisma } from '@/lib/db';
import {
  listAllIdTags, idTagCounts, ID_TAG_STATUS_LABEL, ID_TAG_STATUS_TONE, TONE_CLASS, isIdTagStatus,
  getIdTagEnabledOffices,
} from '@/lib/idTag';
import { getIdTagSettings } from '@/lib/settings';
import { updateIdTagStatusAction, saveIdTagSettingsAction, saveIdTagOfficesAction } from './actions';

export const dynamic = 'force-dynamic';

const STATUS_KEYS = Object.keys(ID_TAG_STATUS_LABEL) as IdTagStatus[];

export default async function AdminIdTagsPage({ searchParams }: { searchParams: { status?: string; dealerId?: string } }) {
  await requireAdminSection('id-tags');

  const statusFilter = searchParams.status && isIdTagStatus(searchParams.status) ? searchParams.status : undefined;
  const dealerFilter = searchParams.dealerId || undefined;

  const [rows, counts, dealers, settings, enabledOffices] = await Promise.all([
    listAllIdTags({ status: statusFilter, dealerId: dealerFilter }),
    idTagCounts(),
    prisma.dealer.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    getIdTagSettings(),
    getIdTagEnabledOffices(),
  ]);
  const enabledSet = new Set(enabledOffices || []);

  const tiles: { n: number; label: string; color: string }[] = [
    { n: counts.needsTraining, label: 'Needs training', color: 'text-amber-700' },
    { n: counts.awaitingScreening, label: 'Awaiting screening', color: 'text-blue-700' },
    { n: counts.approved, label: 'Approved', color: 'text-indigo-700' },
    { n: counts.issued, label: 'Tags issued', color: 'text-green-700' },
    { n: counts.hasTag, label: 'Has tag (existing)', color: 'text-slate-700' },
  ];
  const card = 'rounded-2xl bg-white shadow-sm ring-1 ring-slate-200';

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">ID Tag Requests</h1>
      <p className="mt-1 text-sm text-slate-500">Everyone submitted across all offices. Move each person along as they go through screening.</p>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {tiles.map((t) => (
          <div key={t.label} className={`${card} px-4 py-3`}>
            <div className={`text-2xl font-extrabold ${t.color}`}>{t.n}</div>
            <div className="mt-0.5 text-xs text-slate-500">{t.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <form method="get" className="mt-5 flex flex-wrap items-center gap-2">
        <select name="dealerId" defaultValue={dealerFilter || ''} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">All offices</option>
          {dealers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select name="status" defaultValue={statusFilter || ''} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">All statuses</option>
          {STATUS_KEYS.map((s) => <option key={s} value={s}>{ID_TAG_STATUS_LABEL[s]}</option>)}
        </select>
        <button type="submit" className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700">Filter</button>
        {(statusFilter || dealerFilter) && <Link href="/admin/id-tags" className="px-2 py-2 text-sm text-slate-500 hover:text-slate-800">Clear</Link>}
      </form>

      <div className={`${card} mt-4 overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5 font-semibold">Person</th>
                <th className="px-4 py-2.5 font-semibold">Office</th>
                <th className="px-4 py-2.5 font-semibold">Type</th>
                <th className="px-4 py-2.5 font-semibold">Training</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">Set status</th>
                <th className="px-4 py-2.5 font-semibold">Added</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">No requests match this filter.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 align-middle">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{r.personName}</div>
                    {r.personEmail && <div className="text-xs text-slate-400">{r.personEmail}</div>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.dealerName || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.kind === 'EXISTING' ? 'bg-slate-100 text-slate-600' : 'bg-blue-100 text-blue-700'}`}>
                      {r.kind === 'EXISTING' ? 'Has tag' : 'New'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {r.certified
                      ? <span className="text-xs font-bold text-green-700">✓ Certified</span>
                      : <span className="text-xs font-bold text-red-600">✗ Needs training</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE_CLASS[ID_TAG_STATUS_TONE[r.status]]}`}>
                      {ID_TAG_STATUS_LABEL[r.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <form action={updateIdTagStatusAction} className="flex items-center gap-1.5">
                      <input type="hidden" name="id" value={r.id} />
                      <select name="status" defaultValue={r.status} className="rounded-lg border border-slate-300 px-2 py-1 text-xs">
                        {STATUS_KEYS.map((s) => <option key={s} value={s}>{ID_TAG_STATUS_LABEL[s]}</option>)}
                      </select>
                      <button type="submit" className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-semibold text-white hover:bg-slate-900">Save</button>
                    </form>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">{new Date(r.createdAt).toLocaleDateString('en-CA')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rollout: who can use it */}
      <details className={`${card} mt-6 p-5`} open={rows.length === 0}>
        <summary className="cursor-pointer text-sm font-bold text-slate-900">Who can use it (office rollout)</summary>
        <p className="mt-2 text-xs text-slate-500">
          Check the offices that can see and use HD ID Tags. With <strong>none checked</strong> it defaults to the
          <strong> Georgian Water &amp; Air</strong> office only — so it stays hidden from every other office while you build it.
          Check more offices to roll it out when you’re ready.
        </p>
        <form action={saveIdTagOfficesAction} className="mt-3">
          <div className="grid gap-1.5 sm:grid-cols-2">
            {dealers.map((d) => (
              <label key={d.id} className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" name="offices" value={d.id} defaultChecked={enabledSet.has(d.id)} className="rounded border-slate-300" />
                {d.name}
              </label>
            ))}
          </div>
          <button type="submit" className="mt-3 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">Save rollout</button>
        </form>
      </details>

      {/* Onboarding settings */}
      <details className={`${card} mt-6 p-5`}>
        <summary className="cursor-pointer text-sm font-bold text-slate-900">Onboarding email &amp; screening settings</summary>
        <p className="mt-2 text-xs text-slate-500">
          The background-screening portal link and its shared login/password, plus the email wording. Leave a field blank to use the built-in default.
          You can use <code className="rounded bg-slate-100 px-1">{'{{name}}'}</code>, <code className="rounded bg-slate-100 px-1">{'{{link}}'}</code>,
          <code className="rounded bg-slate-100 px-1">{'{{login}}'}</code> and <code className="rounded bg-slate-100 px-1">{'{{password}}'}</code> inside the new-rep email body.
        </p>
        <form action={saveIdTagSettingsAction} className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Screening portal link</span>
            <input name="screeningLink" defaultValue={settings.screeningLink || ''} placeholder="https://hdis.entuitivetracker.com/" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Login hint</span>
            <input name="screeningLogin" defaultValue={settings.screeningLogin || ''} placeholder="your email address" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Shared password</span>
            <input name="screeningPassword" defaultValue={settings.screeningPassword || ''} placeholder="(set by your office)" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
          <div className="hidden md:block" />
          <label className="block md:col-span-2"><span className="mb-1 block text-xs font-semibold text-slate-600">New-rep email body (background check)</span>
            <textarea name="newEmailBody" defaultValue={settings.newEmailBody || ''} rows={6} placeholder="Leave blank to use the default wording." className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
          <label className="block md:col-span-2"><span className="mb-1 block text-xs font-semibold text-slate-600">Existing-tag email body (welcome)</span>
            <textarea name="existingEmailBody" defaultValue={settings.existingEmailBody || ''} rows={4} placeholder="Leave blank to use the default wording." className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
          <div className="md:col-span-2">
            <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">Save settings</button>
          </div>
        </form>
      </details>
    </div>
  );
}
