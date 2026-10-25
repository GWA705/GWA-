import Link from 'next/link';
import { requireStaffSection } from '@/lib/session';
import { listOfficeIdTagSetup, type OfficeEntuitiveProfile } from '@/lib/idTag';
import { getIdTagBillingRecipients } from '@/lib/settings';
import { saveOfficeSetupAction, saveBillingRecipientsAction } from '../actions';

export const dynamic = 'force-dynamic';

/**
 * Staff → ID tags → Office setup. Reviewers (and admins with the 'id-tags'
 * section) set, per office: the standardized Entuitive screening password and
 * the Entuitive "New User" profile (company name, address, phone, province,
 * service). That office data auto-fills every person's Entuitive setup sheet, so
 * it's entered once here. Also: who the monthly billing list is emailed to.
 */
export default async function StaffIdTagSetupPage() {
  await requireStaffSection('id-tags');
  const [offices, recipients] = await Promise.all([
    listOfficeIdTagSetup(),
    getIdTagBillingRecipients(),
  ]);
  const card = 'rounded-2xl bg-white shadow-sm ring-1 ring-slate-200';
  const inp = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm';
  const lab = 'mb-1 block text-xs font-semibold text-slate-600';

  const fields: { key: keyof OfficeEntuitiveProfile; label: string; placeholder: string; wide?: boolean }[] = [
    { key: 'companyName', label: 'Company name (as Entuitive expects)', placeholder: 'Georgian Water and Air — Barrie', wide: true },
    { key: 'street', label: 'Street #', placeholder: '11' },
    { key: 'streetName', label: 'Street name', placeholder: 'King St' },
    { key: 'unit', label: 'Unit / Apt #', placeholder: '10' },
    { key: 'city', label: 'City', placeholder: 'Barrie' },
    { key: 'province', label: 'Province', placeholder: 'Ontario' },
    { key: 'postal', label: 'Postal code', placeholder: 'L3C 3H6' },
    { key: 'phone', label: 'Office phone', placeholder: '705-812-0320' },
    { key: 'ext', label: 'Ext', placeholder: '' },
    { key: 'service', label: 'Service', placeholder: 'Water Treatment (Home Depot Canada)' },
  ];

  const isComplete = (o: (typeof offices)[number]) => !!o.password && !!(o.profile.companyName && o.profile.street && o.profile.streetName);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-slate-900">ID Tag — office setup</h1>
        <Link href="/staff/id-tags" className="ml-auto text-sm font-semibold text-brand-600 hover:underline">← Back to the board</Link>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Set each office once: its standardized Entuitive password and the Entuitive “New User” details.
        That office data auto-fills every person’s setup sheet, so a dealer only ever enters the person.
      </p>

      <details className={`${card} mt-5 p-5`}>
        <summary className="cursor-pointer text-sm font-bold text-slate-900">Monthly billing recipients</summary>
        <p className="mt-2 text-xs text-slate-500">
          Who the monthly ID-tag activation/billing list is emailed to (on the 1st). One address per line or comma-separated.
          Leave blank to use the defaults.
        </p>
        <form action={saveBillingRecipientsAction} className="mt-3">
          <textarea name="recipients" rows={3} defaultValue={recipients.join('\n')} className={inp} placeholder="vanita@ghsbarrie.ca&#10;info@ghsbarrie.ca&#10;Mona@respiraide.com" />
          <button type="submit" className="mt-3 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">Save recipients</button>
        </form>
      </details>

      <h2 className="mt-7 text-sm font-bold text-slate-900">Offices</h2>
      <p className="mb-2 text-xs text-slate-500">Expand an office to set its Entuitive password and profile.</p>

      <div className="space-y-3">
        {offices.length === 0 && <div className={`${card} p-6 text-center text-sm text-slate-400`}>No active offices.</div>}
        {offices.map((o) => (
          <details key={o.id} className={`${card} p-0 overflow-hidden`}>
            <summary className="flex cursor-pointer items-center gap-3 px-5 py-3.5">
              <span className="font-semibold text-slate-900">{o.name}</span>
              <span className="ml-auto flex items-center gap-1.5">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${o.password ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                  {o.password ? 'Password set' : 'No password'}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${isComplete(o) ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {isComplete(o) ? 'Profile ready' : 'Profile incomplete'}
                </span>
              </span>
            </summary>
            <form action={saveOfficeSetupAction} className="border-t border-slate-100 px-5 py-4">
              <input type="hidden" name="dealerId" value={o.id} />
              <label className="mb-4 block max-w-xs">
                <span className={lab}>Entuitive password</span>
                <input name="password" defaultValue={o.password} placeholder={o.suggestion} autoComplete="off" spellCheck={false} className={`${inp} font-mono`} />
                <span className="mt-1 block text-[11px] text-slate-400">Goes in the new-rep email and the Entuitive “Password” field. Suggested: <code className="rounded bg-slate-100 px-1">{o.suggestion}</code></span>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                {fields.map((f) => (
                  <label key={f.key} className={`block ${f.wide ? 'sm:col-span-2' : ''}`}>
                    <span className={lab}>{f.label}</span>
                    <input name={f.key} defaultValue={o.profile[f.key] || ''} placeholder={f.placeholder} className={inp} />
                  </label>
                ))}
              </div>
              <button type="submit" className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">Save office</button>
            </form>
          </details>
        ))}
      </div>
    </div>
  );
}
