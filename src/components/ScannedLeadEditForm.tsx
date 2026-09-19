'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateScannedLeadAction } from '@/app/(dealer)/dealer/leads/scanActions';
import type { ScannedLeadRow } from './ScannedLeadsList';

/**
 * Inline editor for a scanned (HD Mail In Test) lead — for fixing anything the
 * scanner misread. Pre-filled from the lead; saves the content fields (never the
 * owning office or the billing flag). Reuses the same fields as the scan form.
 */

const CONDITION_OPTS = ['Taste', 'Odors', 'Scale build up', 'Stains'];

export function ScannedLeadEditForm({ lead, onDone }: { lead: ScannedLeadRow; onDone: () => void }) {
  const router = useRouter();
  const [saving, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({
    customerName: lead.customerName ?? '',
    phone: lead.phone ?? '',
    address: lead.address ?? '',
    city: lead.city ?? '',
    postalCode: lead.postalCode ?? '',
    storeNumber: lead.storeNumber ?? '',
    collectedOn: lead.collectedOn ?? '',
    householdSize: lead.householdSize ?? '',
    generatorName: lead.generatorName ?? '',
    ownsHome: lead.ownsHome ?? 'UNKNOWN',
    waterSource: lead.waterSource ?? '',
    waterQuality: lead.waterQuality ?? '',
    conditions: lead.conditions ?? [],
    waterNotes: lead.waterNotes ?? '',
    note: lead.note ?? '',
  });

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  function save() {
    if (!f.customerName.trim() && !f.phone.trim()) {
      setErr('Enter at least a name or a phone number.');
      return;
    }
    setErr(null);
    const fd = new FormData();
    fd.append('customerName', f.customerName);
    fd.append('phone', f.phone);
    fd.append('address', f.address);
    fd.append('city', f.city);
    fd.append('postalCode', f.postalCode);
    fd.append('storeNumber', f.storeNumber);
    fd.append('collectedOn', f.collectedOn);
    fd.append('householdSize', f.householdSize);
    fd.append('generatorName', f.generatorName);
    fd.append('ownsHome', f.ownsHome);
    fd.append('waterSource', f.waterSource);
    fd.append('waterQuality', f.waterQuality);
    fd.append('conditions', JSON.stringify(f.conditions));
    fd.append('waterNotes', f.waterNotes);
    fd.append('note', f.note);
    start(async () => {
      const r = await updateScannedLeadAction(lead.id, fd);
      if (r.error) setErr(r.error);
      else {
        router.refresh();
        onDone();
      }
    });
  }

  const label = 'block text-xs font-semibold text-gray-600 mb-1';
  const field = (k: keyof typeof f, name: string, opts?: { wide?: boolean }) => (
    <div className={opts?.wide ? 'sm:col-span-2' : ''}>
      <label className={label} htmlFor={`ed_${lead.id}_${k}`}>{name}</label>
      <input
        id={`ed_${lead.id}_${k}`}
        value={f[k] as string}
        onChange={(e) => set(k, e.target.value as (typeof f)[typeof k])}
        className="input"
      />
    </div>
  );

  return (
    <div className="mt-3 rounded-xl border border-brand-100 bg-white p-3">
      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-brand-700">Edit lead</div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {field('customerName', 'Customer name')}
        {field('phone', 'Phone')}
        {field('address', 'Address', { wide: true })}
        {field('city', 'City')}
        {field('postalCode', 'Postal code')}
        {field('storeNumber', 'Store #')}
        {field('collectedOn', 'Date collected')}
        {field('householdSize', 'People in household')}
        {field('generatorName', 'Collected by (rep)')}

        <div>
          <label className={label} htmlFor={`ed_${lead.id}_ownsHome`}>Owns home</label>
          <select id={`ed_${lead.id}_ownsHome`} value={f.ownsHome} onChange={(e) => set('ownsHome', e.target.value)} className="input">
            <option value="UNKNOWN">Unknown</option><option value="OWN">Owns</option><option value="RENT">Rents</option><option value="WITH_PARENTS">With parents</option>
          </select>
        </div>
        <div>
          <label className={label} htmlFor={`ed_${lead.id}_waterSource`}>Water source</label>
          <select id={`ed_${lead.id}_waterSource`} value={f.waterSource} onChange={(e) => set('waterSource', e.target.value)} className="input">
            <option value="">—</option><option>City</option><option>Well</option><option>Community Well</option><option>Other</option>
          </select>
        </div>
        <div>
          <label className={label} htmlFor={`ed_${lead.id}_waterQuality`}>Water quality</label>
          <select id={`ed_${lead.id}_waterQuality`} value={f.waterQuality} onChange={(e) => set('waterQuality', e.target.value)} className="input">
            <option value="">—</option><option>Excellent</option><option>Good</option><option>Fair</option><option>Poor</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <span className={label}>Conditions experienced</span>
          <div className="flex flex-wrap gap-3">
            {CONDITION_OPTS.map((opt) => (
              <label key={opt} className="flex items-center gap-1.5 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={f.conditions.includes(opt)}
                  onChange={(e) => set('conditions', e.target.checked ? [...f.conditions, opt] : f.conditions.filter((x) => x !== opt))}
                  className="h-4 w-4 rounded border-gray-300"
                />
                {opt}
              </label>
            ))}
          </div>
        </div>

        <div className="sm:col-span-2">
          <label className={label} htmlFor={`ed_${lead.id}_waterNotes`}>Water notes</label>
          <textarea id={`ed_${lead.id}_waterNotes`} value={f.waterNotes} onChange={(e) => set('waterNotes', e.target.value)} rows={2} className="input" />
        </div>
        <div className="sm:col-span-2">
          <label className={label} htmlFor={`ed_${lead.id}_note`}>Internal note</label>
          <textarea id={`ed_${lead.id}_note`} value={f.note} onChange={(e) => set('note', e.target.value)} rows={2} className="input" />
        </div>
      </div>

      {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
      <div className="mt-3 flex items-center gap-2">
        <button type="button" onClick={save} disabled={saving} className="btn-primary text-sm disabled:opacity-60">
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button type="button" onClick={onDone} disabled={saving} className="btn-secondary text-sm">Cancel</button>
      </div>
    </div>
  );
}
