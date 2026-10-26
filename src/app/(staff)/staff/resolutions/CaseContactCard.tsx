'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormState, useFormStatus } from 'react-dom';
import { updateCaseContactAction } from './actions';
import type { CaseFormState } from './actions';
import type { ExtraContact } from '@/lib/resolutionCases';
import { formatPhoneDisplay } from '@/lib/format';
import { useT } from '@/i18n/client';

interface ContactData {
  caseId: string;
  applicationId: string | null;
  salespersonName: string | null;
  leadGenerator: string | null;
  installerName: string | null;
  officeDealerId: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  customerAddress: string | null;
  spouseName: string | null;
  spousePhone: string | null;
  hdRepName: string | null;
  hdRepPhone: string | null;
  hdRepEmail: string | null;
  extraContacts: ExtraContact[];
}

function SaveBtn() {
  const { pending } = useFormStatus();
  const t = useT();
  return <button type="submit" className="btn-primary text-sm" disabled={pending}>{pending ? t('common.saving') : t('resolution.contact.saveContacts')}</button>;
}

// A phone shown as a tel: link + a email as mailto:, with the value selectable.
function Phone({ v }: { v: string | null }) {
  if (!v) return <span className="text-gray-400 dark:text-slate-500">—</span>;
  return <a href={`tel:${v.replace(/[^\d+]/g, '')}`} className="text-brand-700 hover:underline dark:text-sky-300">{formatPhoneDisplay(v)}</a>;
}
function Email({ v }: { v: string | null }) {
  if (!v) return <span className="text-gray-400 dark:text-slate-500">—</span>;
  return <a href={`mailto:${v}`} className="break-all text-brand-700 hover:underline dark:text-sky-300">{v}</a>;
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="w-20 flex-none text-gray-400 dark:text-slate-500">{label}</span>
      <span className="min-w-0 flex-1 text-gray-800 dark:text-slate-100">{children}</span>
    </div>
  );
}

export function CaseContactCard(props: ContactData) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [state, action] = useFormState(updateCaseContactAction.bind(null, props.caseId), {} as CaseFormState);
  const [rows, setRows] = useState<ExtraContact[]>(props.extraContacts.length ? props.extraContacts : []);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) { setEditing(false); router.refresh(); }
  }, [state.ok, router]);

  if (!editing) {
    return (
      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100">👤 {t('resolution.contact.title')}</h2>
          <button type="button" onClick={() => setEditing(true)} className="text-xs font-medium text-brand-700 hover:underline dark:text-sky-300">✎ {t('common.edit')}</button>
        </div>
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          {/* Customer */}
          <div className="space-y-1.5">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">{t('resolution.contact.customer')}</div>
            <Row label={t('resolution.contact.name')}>
              {props.applicationId ? (
                <Link href={`/staff/find-customer/${props.applicationId}`} className="font-medium text-brand-700 hover:underline dark:text-sky-300">{props.customerName}</Link>
              ) : <span className="font-medium">{props.customerName}</span>}
            </Row>
            <Row label={t('resolution.contact.phone')}><Phone v={props.customerPhone || null} /></Row>
            <Row label={t('resolution.contact.email')}><Email v={props.customerEmail} /></Row>
            <Row label={t('resolution.contact.address')}>{props.customerAddress || <span className="text-gray-400 dark:text-slate-500">—</span>}</Row>
            {(props.spouseName || props.spousePhone) && (
              <Row label={t('resolution.contact.spouse')}><span>{props.spouseName || '—'}{props.spousePhone ? <> · <Phone v={props.spousePhone} /></> : null}</span></Row>
            )}
          </div>
          {/* HD contact */}
          <div className="space-y-1.5">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">{t('resolution.contact.hdContact')}</div>
            {props.hdRepName || props.hdRepPhone || props.hdRepEmail ? (
              <>
                <Row label={t('resolution.contact.rep')}><span className="font-medium">{props.hdRepName || '—'}</span></Row>
                <Row label={t('resolution.contact.phone')}><Phone v={props.hdRepPhone} /></Row>
                <Row label={t('resolution.contact.email')}><Email v={props.hdRepEmail} /></Row>
              </>
            ) : (
              <p className="text-sm text-gray-400 dark:text-slate-500">{t('resolution.contact.noHdRep')}</p>
            )}
          </div>
        </div>
        {(props.salespersonName || props.leadGenerator || props.installerName) && (
          <div className="mt-4 border-t border-gray-100 pt-3 dark:border-slate-700">
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">Sold by</div>
            <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-3">
              <div>
                <div className="text-[11px] text-gray-400 dark:text-slate-500">Salesperson</div>
                <div className="text-sm font-medium text-gray-800 dark:text-slate-100">
                  {props.salespersonName
                    ? (props.officeDealerId
                        ? <Link href={`/staff/directory/${props.officeDealerId}`} className="text-brand-700 hover:underline dark:text-sky-300">{props.salespersonName}</Link>
                        : props.salespersonName)
                    : <span className="text-gray-400 dark:text-slate-500">—</span>}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-gray-400 dark:text-slate-500">Lead generator</div>
                <div className="text-sm font-medium text-gray-800 dark:text-slate-100">{props.leadGenerator || <span className="text-gray-400 dark:text-slate-500">—</span>}</div>
              </div>
              <div>
                <div className="text-[11px] text-gray-400 dark:text-slate-500">Installer</div>
                <div className="text-sm font-medium text-gray-800 dark:text-slate-100">{props.installerName || <span className="text-gray-400 dark:text-slate-500">—</span>}</div>
              </div>
            </div>
            {props.officeDealerId && props.salespersonName && (
              <Link href={`/staff/directory/${props.officeDealerId}`} className="mt-2 inline-block text-xs font-medium text-brand-700 hover:underline dark:text-sky-300">View office profile →</Link>
            )}
          </div>
        )}
        {props.extraContacts.length > 0 && (
          <div className="mt-4 border-t border-gray-100 pt-3 dark:border-slate-700">
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">{t('resolution.contact.otherContacts')}</div>
            <div className="flex flex-col gap-1.5">
              {props.extraContacts.map((x, i) => (
                <div key={i} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
                  <span className="font-medium text-gray-800 dark:text-slate-100">{x.name || '—'}</span>
                  {x.role && <span className="text-xs text-gray-400 dark:text-slate-500">({x.role})</span>}
                  {x.phone && <><span className="text-gray-300">·</span><Phone v={x.phone} /></>}
                  {x.email && <><span className="text-gray-300">·</span><Email v={x.email} /></>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- Edit mode ---
  const input = 'input';
  return (
    <form action={action} className="card space-y-4 p-5">
      {state.error && <div className="rounded-md bg-red-50 p-2 text-sm text-red-700">{state.error}</div>}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100">👤 {t('resolution.contact.editTitle')}</h2>
      </div>

      <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">{t('resolution.contact.customer')}</div>
          <div><label className="label">{t('resolution.contact.name')}</label><input name="customerName" defaultValue={props.customerName} className={input} /></div>
          <div><label className="label">{t('resolution.contact.phone')}</label><input name="customerPhone" defaultValue={props.customerPhone} className={input} placeholder="705-555-0148" /></div>
          <div><label className="label">{t('resolution.contact.email')}</label><input name="customerEmail" type="email" defaultValue={props.customerEmail ?? ''} className={input} /></div>
          <div><label className="label">{t('resolution.contact.address')}</label><input name="customerAddress" defaultValue={props.customerAddress ?? ''} className={input} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">{t('resolution.contact.spouseName')}</label><input name="spouseName" defaultValue={props.spouseName ?? ''} className={input} /></div>
            <div><label className="label">{t('resolution.contact.spousePhone')}</label><input name="spousePhone" defaultValue={props.spousePhone ?? ''} className={input} /></div>
          </div>
        </div>
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">{t('resolution.contact.hdContact')}</div>
          <div><label className="label">{t('resolution.contact.repName')}</label><input name="hdRepName" defaultValue={props.hdRepName ?? ''} className={input} placeholder={t('resolution.contact.repNamePlaceholder')} /></div>
          <div><label className="label">{t('resolution.contact.repPhone')}</label><input name="hdRepPhone" defaultValue={props.hdRepPhone ?? ''} className={input} placeholder={t('resolution.contact.repPhonePlaceholder')} /></div>
          <div><label className="label">{t('resolution.contact.repEmail')}</label><input name="hdRepEmail" type="email" defaultValue={props.hdRepEmail ?? ''} className={input} /></div>
        </div>
      </div>

      {/* Extra contacts */}
      <div className="border-t border-gray-100 pt-3 dark:border-slate-700">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">{t('resolution.contact.otherContacts')}</span>
          <button type="button" onClick={() => setRows((r) => [...r, { name: '', role: '', phone: '', email: '' }])} className="text-xs font-medium text-brand-700 hover:underline dark:text-sky-300">＋ {t('resolution.contact.addContact')}</button>
        </div>
        <div className="flex flex-col gap-2">
          {rows.length === 0 && <p className="text-xs text-gray-400 dark:text-slate-500">{t('resolution.contact.extraHint')}</p>}
          {rows.map((x, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1.2fr_0.9fr_1fr_1.4fr_auto]">
              <input name="extraName" defaultValue={x.name} className={input} placeholder={t('resolution.contact.name')} />
              <input name="extraRole" defaultValue={x.role} className={input} placeholder={t('resolution.contact.rolePlaceholder')} />
              <input name="extraPhone" defaultValue={x.phone} className={input} placeholder={t('resolution.contact.phone')} />
              <input name="extraEmail" defaultValue={x.email} className={input} placeholder={t('resolution.contact.email')} />
              <button type="button" onClick={() => setRows((r) => r.filter((_, j) => j !== i))} className="rounded-md border border-gray-200 px-2 text-gray-500 hover:border-red-400 hover:text-red-600 dark:border-slate-600" aria-label="Remove">✕</button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setEditing(false)} className="btn-secondary text-sm">{t('common.cancel')}</button>
        <SaveBtn />
      </div>
    </form>
  );
}
