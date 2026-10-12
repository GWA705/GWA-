'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '@/i18n/client';
import { updateScannedLeadAction } from '@/app/(dealer)/dealer/leads/scanActions';
import type { ScannedLeadRow } from './ScannedLeadsList';

/**
 * Inline editor for a scanned (HD Mail In Test) lead — for fixing anything the
 * scanner misread. Pre-filled from the lead; saves the content fields (never the
 * owning office or the billing flag). Reuses the same fields as the scan form.
 */

const CONDITION_OPTS = ['Taste', 'Odors', 'Scale build up', 'Stains'];
// Stored condition value → translation key (the value itself is sent to the server).
const CONDITION_KEY: Record<string, string> = {
  Taste: 'leadUi.condition.taste',
  Odors: 'leadUi.condition.odors',
  'Scale build up': 'leadUi.condition.scaleBuildUp',
  Stains: 'leadUi.condition.stains',
};

export function ScannedLeadEditForm({ lead, onDone }: { lead: ScannedLeadRow; onDone: () => void }) {
  const t = useT();
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
      setErr(t('leadUi.scan.needNameOrPhone'));
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
      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-brand-700">{t('leadUi.edit.title')}</div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {field('customerName', t('leadUi.field.customerName'))}
        {field('phone', t('leadUi.field.phone'))}
        {field('address', t('leadUi.field.address'), { wide: true })}
        {field('city', t('leadUi.field.city'))}
        {field('postalCode', t('leadUi.field.postalCode'))}
        {field('storeNumber', t('leadUi.field.storeNumber'))}
        {field('collectedOn', t('leadUi.field.collectedOn'))}
        {field('householdSize', t('leadUi.field.householdSize'))}
        {field('generatorName', t('leadUi.field.generatorName'))}

        <div>
          <label className={label} htmlFor={`ed_${lead.id}_ownsHome`}>{t('leadUi.field.ownsHome')}</label>
          <select id={`ed_${lead.id}_ownsHome`} value={f.ownsHome} onChange={(e) => set('ownsHome', e.target.value)} className="input">
            <option value="UNKNOWN">{t('leadUi.ownsHome.unknown')}</option><option value="OWN">{t('leadUi.ownsHome.owns')}</option><option value="RENT">{t('leadUi.ownsHome.rents')}</option><option value="WITH_PARENTS">{t('leadUi.ownsHome.withParents')}</option>
          </select>
        </div>
        <div>
          <label className={label} htmlFor={`ed_${lead.id}_waterSource`}>{t('leadUi.field.waterSource')}</label>
          <select id={`ed_${lead.id}_waterSource`} value={f.waterSource} onChange={(e) => set('waterSource', e.target.value)} className="input">
            <option value="">—</option><option value="City">{t('leadUi.waterSource.city')}</option><option value="Well">{t('leadUi.waterSource.well')}</option><option value="Community Well">{t('leadUi.waterSource.communityWell')}</option><option value="Other">{t('leadUi.waterSource.other')}</option>
          </select>
        </div>
        <div>
          <label className={label} htmlFor={`ed_${lead.id}_waterQuality`}>{t('leadUi.field.waterQuality')}</label>
          <select id={`ed_${lead.id}_waterQuality`} value={f.waterQuality} onChange={(e) => set('waterQuality', e.target.value)} className="input">
            <option value="">—</option><option value="Excellent">{t('leadUi.waterQuality.excellent')}</option><option value="Good">{t('leadUi.waterQuality.good')}</option><option value="Fair">{t('leadUi.waterQuality.fair')}</option><option value="Poor">{t('leadUi.waterQuality.poor')}</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <span className={label}>{t('leadUi.field.conditions')}</span>
          <div className="flex flex-wrap gap-3">
            {CONDITION_OPTS.map((opt) => (
              <label key={opt} className="flex items-center gap-1.5 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={f.conditions.includes(opt)}
                  onChange={(e) => set('conditions', e.target.checked ? [...f.conditions, opt] : f.conditions.filter((x) => x !== opt))}
                  className="h-4 w-4 rounded border-gray-300"
                />
                {t(CONDITION_KEY[opt])}
              </label>
            ))}
          </div>
        </div>

        <div className="sm:col-span-2">
          <label className={label} htmlFor={`ed_${lead.id}_waterNotes`}>{t('leadUi.field.waterNotes')}</label>
          <textarea id={`ed_${lead.id}_waterNotes`} value={f.waterNotes} onChange={(e) => set('waterNotes', e.target.value)} rows={2} className="input" />
        </div>
        <div className="sm:col-span-2">
          <label className={label} htmlFor={`ed_${lead.id}_note`}>{t('leadUi.field.internalNote')}</label>
          <textarea id={`ed_${lead.id}_note`} value={f.note} onChange={(e) => set('note', e.target.value)} rows={2} className="input" />
        </div>
      </div>

      {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
      <div className="mt-3 flex items-center gap-2">
        <button type="button" onClick={save} disabled={saving} className="btn-primary text-sm disabled:opacity-60">
          {saving ? t('common.saving') : t('leadUi.edit.saveChanges')}
        </button>
        <button type="button" onClick={onDone} disabled={saving} className="btn-secondary text-sm">{t('common.cancel')}</button>
      </div>
    </div>
  );
}
