'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '@/i18n/client';
import { createScannedLeadAction } from '@/app/(dealer)/dealer/leads/scanActions';

// Mirrors leadScanner.ts CardExtraction (kept local — no server import), plus the
// photoIndex the route tags each card with (which uploaded photo it came from).
interface CardExtraction {
  name: string | null; phone: string | null; occupation: string | null;
  spouseName: string | null; spousePhone: string | null; spouseOccupation: string | null;
  address: string | null; city: string | null; postalCode: string | null;
  bestTimeToContact: string | null; waterNotes: string | null; hasWellWater: boolean | null;
  ownsHome: 'OWN' | 'RENT' | 'WITH_PARENTS' | 'UNKNOWN';
  buysBottledWater: boolean | null; hasFilters: boolean | null;
  householdSize: string | null;
  waterSource: 'City' | 'Well' | 'Community Well' | 'Other' | null;
  waterQuality: 'Excellent' | 'Good' | 'Fair' | 'Poor' | null;
  conditions: ('Taste' | 'Odors' | 'Scale build up' | 'Stains')[];
  storeNumber: string | null; collectedOn: string | null; generatorName: string | null;
  confidence: number; uncertainFields: string[];
  photoIndex?: number;
}
interface ScanResult { available: boolean; cards?: CardExtraction[]; error?: string }

type Fields = {
  customerName: string; phone: string; occupation: string;
  spouseName: string; spousePhone: string; spouseOccupation: string;
  address: string; city: string; postalCode: string;
  storeNumber: string; collectedOn: string; bestTimeToContact: string; generatorName: string;
  householdSize: string;
  ownsHome: string; waterSource: string; waterQuality: string;
  buysBottledWater: string; hasFilters: string; hasWellWater: string;
  conditions: string[]; waterNotes: string; note: string;
};

// One card being reviewed: the editable fields plus the read metadata.
type CardForm = Fields & {
  uncertain: string[]; confidence: number | null; rawJson: string;
  photoIndex: number; // which uploaded photo this card came from (-1 = typed by hand)
  saved: boolean; error: string | null;
};

const EMPTY_FIELDS: Fields = {
  customerName: '', phone: '', occupation: '', spouseName: '', spousePhone: '', spouseOccupation: '',
  address: '', city: '', postalCode: '', storeNumber: '', collectedOn: '', bestTimeToContact: '', generatorName: '',
  householdSize: '',
  ownsHome: 'UNKNOWN', waterSource: '', waterQuality: '', buysBottledWater: '', hasFilters: '', hasWellWater: '',
  conditions: [], waterNotes: '', note: '',
};

const CONDITION_OPTS = ['Taste', 'Odors', 'Scale build up', 'Stains'];
// Stored condition value → translation key (the value itself is sent to the server).
const CONDITION_KEY: Record<string, string> = {
  Taste: 'leadUi.condition.taste',
  Odors: 'leadUi.condition.odors',
  'Scale build up': 'leadUi.condition.scaleBuildUp',
  Stains: 'leadUi.condition.stains',
};
const boolToStr = (b: boolean | null) => (b === true ? 'true' : b === false ? 'false' : '');

function emptyCard(photoIndex: number): CardForm {
  return { ...EMPTY_FIELDS, uncertain: [], confidence: null, rawJson: '', photoIndex, saved: false, error: null };
}
function cardFromExtraction(d: CardExtraction): CardForm {
  return {
    customerName: d.name ?? '', phone: d.phone ?? '', occupation: d.occupation ?? '',
    spouseName: d.spouseName ?? '', spousePhone: d.spousePhone ?? '', spouseOccupation: d.spouseOccupation ?? '',
    address: d.address ?? '', city: d.city ?? '', postalCode: d.postalCode ?? '',
    storeNumber: d.storeNumber ?? '', collectedOn: d.collectedOn ?? '', bestTimeToContact: d.bestTimeToContact ?? '',
    generatorName: d.generatorName ?? '', householdSize: d.householdSize ?? '', ownsHome: d.ownsHome ?? 'UNKNOWN', waterSource: d.waterSource ?? '',
    waterQuality: d.waterQuality ?? '', buysBottledWater: boolToStr(d.buysBottledWater), hasFilters: boolToStr(d.hasFilters),
    hasWellWater: boolToStr(d.hasWellWater), conditions: d.conditions ?? [], waterNotes: d.waterNotes ?? '', note: '',
    uncertain: d.uncertainFields ?? [], confidence: typeof d.confidence === 'number' ? d.confidence : null,
    rawJson: JSON.stringify(d), photoIndex: typeof d.photoIndex === 'number' ? d.photoIndex : 0,
    saved: false, error: null,
  };
}

export function ScanLeadCard({ onSaved }: { onSaved?: () => void }) {
  const t = useT();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [cards, setCards] = useState<CardForm[]>([]);
  const [openIdx, setOpenIdx] = useState<Set<number>>(new Set([0]));
  const [saving, startSave] = useTransition();
  const [saveMsg, setSaveMsg] = useState<{ ok?: boolean; text: string } | null>(null);

  const setField = <K extends keyof Fields>(idx: number, k: K, v: Fields[K]) =>
    setCards((cs) => cs.map((c, i) => (i === idx ? { ...c, [k]: v } : c)));
  const toggleOpen = (idx: number) =>
    setOpenIdx((s) => { const n = new Set(s); n.has(idx) ? n.delete(idx) : n.add(idx); return n; });

  function resetAll() {
    setPreviews((old) => { old.forEach((u) => URL.revokeObjectURL(u)); return []; });
    setCards([]);
    setScanError(null);
    setSaveMsg(null);
    setOpenIdx(new Set([0]));
    if (fileRef.current) fileRef.current.value = '';
  }

  function onPick() {
    const files = Array.from(fileRef.current?.files ?? []);
    setPreviews((old) => { old.forEach((u) => URL.revokeObjectURL(u)); return files.map((f) => URL.createObjectURL(f)); });
    setCards([]);
    setScanError(null);
    setSaveMsg(null);
  }

  async function scan() {
    const files = Array.from(fileRef.current?.files ?? []);
    if (files.length === 0) { setScanError(t('leadUi.scan.choosePhotoFirst')); return; }
    const fd = new FormData();
    for (const f of files) fd.append('cardImage', f);
    setScanning(true);
    setScanError(null);
    setSaveMsg(null);
    try {
      const res = await fetch('/api/leads/scan-card', { method: 'POST', body: fd });
      const json: ScanResult = await res.json();
      const found = json.cards ?? [];
      if (found.length > 0) {
        setCards(found.map(cardFromExtraction));
        setOpenIdx(new Set(found.length === 1 ? [0] : [0])); // first open; others collapsed
        if (json.error) setScanError(json.error);
      } else {
        // Nothing read — drop in one blank card (with the first photo attached) to type by hand.
        setCards([emptyCard(0)]);
        setOpenIdx(new Set([0]));
        setScanError(json.error ?? t('leadUi.scan.noneRead'));
      }
    } catch {
      setCards([emptyCard(0)]);
      setOpenIdx(new Set([0]));
      setScanError(t('leadUi.scan.readerUnreachable'));
    } finally {
      setScanning(false);
    }
  }

  function addBlankCard() {
    setCards((cs) => { setOpenIdx(new Set([cs.length])); return [...cs, emptyCard(-1)]; });
  }
  function removeCard(idx: number) {
    setCards((cs) => cs.filter((_, i) => i !== idx));
  }

  function saveAll() {
    const pending = cards.filter((c) => !c.saved);
    if (pending.length === 0) return;
    // Every card needs at least a name or phone.
    if (pending.some((c) => !c.customerName.trim() && !c.phone.trim())) {
      setSaveMsg({ text: t('leadUi.scan.needNameOrPhoneAll') });
      return;
    }
    setSaveMsg(null);
    startSave(async () => {
      const files = fileRef.current?.files ?? null;
      let ok = 0;
      const next = [...cards];
      for (let i = 0; i < next.length; i++) {
        const c = next[i];
        if (c.saved) { ok++; continue; }
        const fd = new FormData();
        const { uncertain, confidence, rawJson, photoIndex, saved, error, ...fields } = c;
        void saved; void error;
        Object.entries(fields).forEach(([k, v]) => {
          if (k === 'conditions') fd.append('conditions', JSON.stringify(v));
          else fd.append(k, String(v));
        });
        fd.append('uncertainFields', JSON.stringify(uncertain));
        if (rawJson) fd.append('rawJson', rawJson);
        if (confidence != null) fd.append('confidence', String(confidence));
        const photo = photoIndex >= 0 ? files?.[photoIndex] : null;
        if (photo) fd.append('photo', photo);
        const r = await createScannedLeadAction({}, fd);
        if (r.ok) { next[i] = { ...c, saved: true, error: null }; ok++; }
        else { next[i] = { ...c, error: r.error ?? t('leadUi.scan.couldNotSave') }; }
      }
      setCards(next);
      const total = next.length;
      if (ok === total) {
        setSaveMsg({ ok: true, text: ok === 1 ? t('leadUi.scan.savedOne', { count: ok }) : t('leadUi.scan.savedMany', { count: ok }) });
        router.refresh();
        onSaved?.();
        // Clear the workspace shortly after a clean save.
        setTimeout(resetAll, 1200);
      } else {
        setSaveMsg({ text: t('leadUi.scan.savedPartial', { ok, total }) });
        router.refresh();
        onSaved?.();
      }
    });
  }

  const label = 'block text-xs font-semibold text-gray-600 mb-1';
  const field = (idx: number, k: keyof Fields, name: string, opts?: { wide?: boolean }) => {
    const uncertain = cards[idx]?.uncertain.includes(k as string);
    return (
      <div className={opts?.wide ? 'sm:col-span-2' : ''}>
        <label className={label} htmlFor={`sl_${idx}_${k}`}>
          {name}{uncertain && <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] font-bold text-amber-800">{t('leadUi.scan.check')}</span>}
        </label>
        <input id={`sl_${idx}_${k}`} value={cards[idx][k] as string} onChange={(e) => setField(idx, k, e.target.value as Fields[typeof k])}
          className={`input ${uncertain ? 'ring-2 ring-amber-300' : ''}`} />
      </div>
    );
  };

  const hasCards = cards.length > 0;
  const unsaved = cards.filter((c) => !c.saved).length;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="text-base font-bold text-[#0d2a63]">{t('leadUi.scan.addTitle')}</div>
        {(hasCards || previews.length > 0) && (
          <button type="button" onClick={resetAll} className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50">
            ← {t('leadUi.scan.startOver')}
          </button>
        )}
      </div>
      <p className="mb-3 text-xs text-gray-500">
        {t('leadUi.scan.help1')}<strong>{t('leadUi.scan.helpStrong')}</strong>{t('leadUi.scan.help2')}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        {/* No `capture` attribute: leaving it off lets the device offer Take Photo,
            Photo Library AND Choose File, instead of forcing the camera. */}
        <input ref={fileRef} name="cardImage" type="file" accept="image/*" multiple onChange={onPick} className="text-sm" />
        <button type="button" onClick={scan} disabled={scanning}
          className="rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
          {scanning ? t('leadUi.scan.reading') : previews.length > 1 ? t('leadUi.scan.readN', { count: previews.length }) : t('leadUi.scan.readCards')}
        </button>
        {!hasCards && (
          <button type="button" onClick={addBlankCard} className="text-sm text-gray-500 hover:underline">
            {t('leadUi.scan.enterByHand')}
          </button>
        )}
      </div>

      {previews.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {previews.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={src} alt={t('leadUi.scan.photoAlt', { n: i + 1 })} className="h-20 w-20 rounded-lg border border-gray-200 object-cover" />
          ))}
        </div>
      )}

      {scanError && (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{scanError}</p>
      )}
      {hasCards && cards.length > 1 && (
        <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          {t('leadUi.scan.foundN', { count: cards.length })}
        </p>
      )}

      {hasCards && (
        <div className="mt-4 space-y-3">
          {cards.map((c, idx) => {
            const open = openIdx.has(idx);
            const title = c.customerName.trim() || c.phone.trim() || t('leadUi.scan.untitledCard');
            return (
              <div key={idx} className={`rounded-xl border ${c.saved ? 'border-green-300 bg-green-50/40' : c.error ? 'border-red-300' : 'border-gray-200'}`}>
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <button type="button" onClick={() => toggleOpen(idx)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">{idx + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-gray-900">{title}</span>
                      <span className="block truncate text-xs text-gray-500">
                        {[c.phone, c.city, c.storeNumber && t('leadUi.lead.storeNum', { n: c.storeNumber })].filter(Boolean).join(' · ') || t('leadUi.scan.noDetailsYet')}
                      </span>
                    </span>
                    {c.saved && <span className="flex-none rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">{t('common.saved')}</span>}
                    {!c.saved && c.confidence != null && <span className="flex-none rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">{c.confidence}%</span>}
                    <svg className={`h-4 w-4 flex-none text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 8l4 4 4-4" /></svg>
                  </button>
                  {!c.saved && (
                    <button type="button" onClick={() => removeCard(idx)} aria-label="Remove card" className="flex-none rounded-md p-1 text-gray-400 hover:bg-gray-50 hover:text-red-600">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                    </button>
                  )}
                </div>

                {open && !c.saved && (
                  <div className="grid grid-cols-1 gap-3 border-t border-gray-100 p-3 sm:grid-cols-2">
                    {field(idx, 'customerName', t('leadUi.field.customerName'))}
                    {field(idx, 'phone', t('leadUi.field.phone'))}
                    {field(idx, 'address', t('leadUi.field.address'), { wide: true })}
                    {field(idx, 'city', t('leadUi.field.city'))}
                    {field(idx, 'postalCode', t('leadUi.field.postalCode'))}
                    {field(idx, 'occupation', t('leadUi.field.occupation'))}
                    {field(idx, 'bestTimeToContact', t('leadUi.field.bestTimeToContact'))}
                    {field(idx, 'householdSize', t('leadUi.field.householdSize'))}
                    {field(idx, 'storeNumber', t('leadUi.field.storeNumber'))}
                    {field(idx, 'collectedOn', t('leadUi.field.collectedOn'))}
                    {field(idx, 'spouseName', t('leadUi.field.spouseName'))}
                    {field(idx, 'spousePhone', t('leadUi.field.spousePhone'))}
                    {field(idx, 'generatorName', t('leadUi.field.generatorName'))}

                    <div>
                      <label className={label} htmlFor={`sl_${idx}_ownsHome`}>{t('leadUi.field.ownsHome')}</label>
                      <select id={`sl_${idx}_ownsHome`} value={c.ownsHome} onChange={(e) => setField(idx, 'ownsHome', e.target.value)} className="input">
                        <option value="UNKNOWN">{t('leadUi.ownsHome.unknown')}</option><option value="OWN">{t('leadUi.ownsHome.owns')}</option><option value="RENT">{t('leadUi.ownsHome.rents')}</option><option value="WITH_PARENTS">{t('leadUi.ownsHome.withParents')}</option>
                      </select>
                    </div>
                    <div>
                      <label className={label} htmlFor={`sl_${idx}_waterSource`}>{t('leadUi.field.waterSource')}</label>
                      <select id={`sl_${idx}_waterSource`} value={c.waterSource} onChange={(e) => setField(idx, 'waterSource', e.target.value)} className="input">
                        <option value="">—</option><option value="City">{t('leadUi.waterSource.city')}</option><option value="Well">{t('leadUi.waterSource.well')}</option><option value="Community Well">{t('leadUi.waterSource.communityWell')}</option><option value="Other">{t('leadUi.waterSource.other')}</option>
                      </select>
                    </div>
                    <div>
                      <label className={label} htmlFor={`sl_${idx}_waterQuality`}>{t('leadUi.field.waterQuality')}</label>
                      <select id={`sl_${idx}_waterQuality`} value={c.waterQuality} onChange={(e) => setField(idx, 'waterQuality', e.target.value)} className="input">
                        <option value="">—</option><option value="Excellent">{t('leadUi.waterQuality.excellent')}</option><option value="Good">{t('leadUi.waterQuality.good')}</option><option value="Fair">{t('leadUi.waterQuality.fair')}</option><option value="Poor">{t('leadUi.waterQuality.poor')}</option>
                      </select>
                    </div>
                    <div>
                      <label className={label} htmlFor={`sl_${idx}_buysBottledWater`}>{t('leadUi.field.buysBottledWater')}</label>
                      <select id={`sl_${idx}_buysBottledWater`} value={c.buysBottledWater} onChange={(e) => setField(idx, 'buysBottledWater', e.target.value)} className="input">
                        <option value="">—</option><option value="true">{t('common.yes')}</option><option value="false">{t('common.no')}</option>
                      </select>
                    </div>
                    <div>
                      <label className={label} htmlFor={`sl_${idx}_hasFilters`}>{t('leadUi.field.hasFiltersNow')}</label>
                      <select id={`sl_${idx}_hasFilters`} value={c.hasFilters} onChange={(e) => setField(idx, 'hasFilters', e.target.value)} className="input">
                        <option value="">—</option><option value="true">{t('common.yes')}</option><option value="false">{t('common.no')}</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <span className={label}>{t('leadUi.field.conditions')}</span>
                      <div className="flex flex-wrap gap-3">
                        {CONDITION_OPTS.map((opt) => (
                          <label key={opt} className="flex items-center gap-1.5 text-sm text-gray-700">
                            <input type="checkbox" checked={c.conditions.includes(opt)}
                              onChange={(e) => setField(idx, 'conditions', e.target.checked ? [...c.conditions, opt] : c.conditions.filter((x) => x !== opt))}
                              className="h-4 w-4 rounded border-gray-300" />
                            {t(CONDITION_KEY[opt])}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <label className={label} htmlFor={`sl_${idx}_waterNotes`}>{t('leadUi.field.waterNotes')}</label>
                      <textarea id={`sl_${idx}_waterNotes`} value={c.waterNotes} onChange={(e) => setField(idx, 'waterNotes', e.target.value)} rows={2} className="input" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={label} htmlFor={`sl_${idx}_note`}>{t('leadUi.field.internalNoteOptional')}</label>
                      <textarea id={`sl_${idx}_note`} value={c.note} onChange={(e) => setField(idx, 'note', e.target.value)} rows={2} className="input" placeholder={t('leadUi.scan.internalNotePlaceholder')} />
                    </div>
                    {c.error && <p className="sm:col-span-2 text-sm text-red-600">{c.error}</p>}
                  </div>
                )}
              </div>
            );
          })}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button type="button" onClick={saveAll} disabled={saving || unsaved === 0}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
              {saving ? t('common.saving') : unsaved > 1 ? t('leadUi.scan.saveAllN', { count: unsaved }) : t('leadUi.scan.saveLead')}
            </button>
            <button type="button" onClick={addBlankCard} className="text-sm text-gray-500 hover:underline">+ {t('leadUi.scan.addAnotherCard')}</button>
            <button type="button" onClick={resetAll} className="text-sm text-gray-500 hover:underline">{t('common.cancel')}</button>
            {saveMsg && <span className={`text-sm ${saveMsg.ok ? 'text-green-700' : 'text-red-600'}`}>{saveMsg.text}</span>}
          </div>
        </div>
      )}
      {!hasCards && saveMsg?.ok && <p className="mt-3 text-sm text-green-700">{saveMsg.text}</p>}
    </div>
  );
}
