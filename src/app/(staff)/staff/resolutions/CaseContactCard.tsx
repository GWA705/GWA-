'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormState, useFormStatus } from 'react-dom';
import { updateCaseContactAction } from './actions';
import type { CaseFormState } from './actions';
import type { ExtraContact } from '@/lib/resolutionCases';
import { formatPhoneDisplay } from '@/lib/format';

interface ContactData {
  caseId: string;
  applicationId: string | null;
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
  return <button type="submit" className="btn-primary text-sm" disabled={pending}>{pending ? 'Saving…' : 'Save contacts'}</button>;
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
          <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100">👤 Contacts</h2>
          <button type="button" onClick={() => setEditing(true)} className="text-xs font-medium text-brand-700 hover:underline dark:text-sky-300">✎ Edit</button>
        </div>
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          {/* Customer */}
          <div className="space-y-1.5">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">Customer</div>
            <Row label="Name">
              {props.applicationId ? (
                <Link href={`/staff/find-customer/${props.applicationId}`} className="font-medium text-brand-700 hover:underline dark:text-sky-300">{props.customerName}</Link>
              ) : <span className="font-medium">{props.customerName}</span>}
            </Row>
            <Row label="Phone"><Phone v={props.customerPhone || null} /></Row>
            <Row label="Email"><Email v={props.customerEmail} /></Row>
            <Row label="Address">{props.customerAddress || <span className="text-gray-400 dark:text-slate-500">—</span>}</Row>
            {(props.spouseName || props.spousePhone) && (
              <Row label="Spouse"><span>{props.spouseName || '—'}{props.spousePhone ? <> · <Phone v={props.spousePhone} /></> : null}</span></Row>
            )}
          </div>
          {/* HD contact */}
          <div className="space-y-1.5">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">Home Depot contact</div>
            {props.hdRepName || props.hdRepPhone || props.hdRepEmail ? (
              <>
                <Row label="Rep"><span className="font-medium">{props.hdRepName || '—'}</span></Row>
                <Row label="Phone"><Phone v={props.hdRepPhone} /></Row>
                <Row label="Email"><Email v={props.hdRepEmail} /></Row>
              </>
            ) : (
              <p className="text-sm text-gray-400 dark:text-slate-500">No HD rep recorded yet — add Brooke / Sandra / Dennis, etc.</p>
            )}
          </div>
        </div>
        {props.extraContacts.length > 0 && (
          <div className="mt-4 border-t border-gray-100 pt-3 dark:border-slate-700">
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">Other contacts</div>
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
        <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100">👤 Edit contacts</h2>
      </div>

      <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">Customer</div>
          <div><label className="label">Name</label><input name="customerName" defaultValue={props.customerName} className={input} /></div>
          <div><label className="label">Phone</label><input name="customerPhone" defaultValue={props.customerPhone} className={input} placeholder="705-555-0148" /></div>
          <div><label className="label">Email</label><input name="customerEmail" type="email" defaultValue={props.customerEmail ?? ''} className={input} /></div>
          <div><label className="label">Address</label><input name="customerAddress" defaultValue={props.customerAddress ?? ''} className={input} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">Spouse name</label><input name="spouseName" defaultValue={props.spouseName ?? ''} className={input} /></div>
            <div><label className="label">Spouse phone</label><input name="spousePhone" defaultValue={props.spousePhone ?? ''} className={input} /></div>
          </div>
        </div>
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">Home Depot contact</div>
          <div><label className="label">Rep name</label><input name="hdRepName" defaultValue={props.hdRepName ?? ''} className={input} placeholder="e.g. Brooke Reed" /></div>
          <div><label className="label">Rep phone</label><input name="hdRepPhone" defaultValue={props.hdRepPhone ?? ''} className={input} placeholder="1-800-910-6704 ext. 177508" /></div>
          <div><label className="label">Rep email</label><input name="hdRepEmail" type="email" defaultValue={props.hdRepEmail ?? ''} className={input} /></div>
        </div>
      </div>

      {/* Extra contacts */}
      <div className="border-t border-gray-100 pt-3 dark:border-slate-700">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">Other contacts</span>
          <button type="button" onClick={() => setRows((r) => [...r, { name: '', role: '', phone: '', email: '' }])} className="text-xs font-medium text-brand-700 hover:underline dark:text-sky-300">＋ Add contact</button>
        </div>
        <div className="flex flex-col gap-2">
          {rows.length === 0 && <p className="text-xs text-gray-400 dark:text-slate-500">Add a number given on a call — e.g. the customer&apos;s spouse.</p>}
          {rows.map((x, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1.2fr_0.9fr_1fr_1.4fr_auto]">
              <input name="extraName" defaultValue={x.name} className={input} placeholder="Name" />
              <input name="extraRole" defaultValue={x.role} className={input} placeholder="Role (spouse…)" />
              <input name="extraPhone" defaultValue={x.phone} className={input} placeholder="Phone" />
              <input name="extraEmail" defaultValue={x.email} className={input} placeholder="Email" />
              <button type="button" onClick={() => setRows((r) => r.filter((_, j) => j !== i))} className="rounded-md border border-gray-200 px-2 text-gray-500 hover:border-red-400 hover:text-red-600 dark:border-slate-600" aria-label="Remove">✕</button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setEditing(false)} className="btn-secondary text-sm">Cancel</button>
        <SaveBtn />
      </div>
    </form>
  );
}
