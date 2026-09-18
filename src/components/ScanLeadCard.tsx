'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
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
  waterSource: 'City' | 'Well' | 'Other' | null;
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
  ownsHome: 'UNKNOWN', waterSource: '', waterQuality: '', buysBottledWater: '', hasFilters: '', hasWellWater: '',
  conditions: [], waterNotes: '', note: '',
};

const CONDITION_OPTS = ['Taste', 'Odors', 'Scale build up', 'Stains'];
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
    generatorName: d.generatorName ?? '', ownsHome: d.ownsHome ?? 'UNKNOWN', waterSource: d.waterSource ?? '',
    waterQuality: d.waterQuality ?? '', buysBottledWater: boolToStr(d.buysBottledWater), hasFilters: boolToStr(d.hasFilters),
    hasWellWater: boolToStr(d.hasWellWater), conditions: d.conditions ?? [], waterNotes: d.waterNotes ?? '', note: '',
    uncertain: d.uncertainFields ?? [], confidence: typeof d.confidence === 'number' ? d.confidence : null,
    rawJson: JSON.stringify(d), photoIndex: typeof d.photoIndex === 'number' ? d.photoIndex : 0,
    saved: false, error: null,
  };
}

export function ScanLeadCard({ onSaved }: { onSaved?: () => void }) {
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
    if (files.length === 0) { setScanError('Choose a photo of the card first.'); return; }
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
        setScanError(json.error ?? 'No card details could be read — please type it in.');
      }
    } catch {
      setCards([emptyCard(0)]);
      setOpenIdx(new Set([0]));
      setScanError('Could not reach the card reader. Type the card in instead.');
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
      setSaveMsg({ text: 'Each card needs at least a name or a phone number — fill or remove the empty ones.' });
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
        else { next[i] = { ...c, error: r.error ?? 'Could not save.' }; }
      }
      setCards(next);
      const total = next.length;
      if (ok === total) {
        setSaveMsg({ ok: true, text: `Saved ${ok} lead${ok === 1 ? '' : 's'}.` });
        router.refresh();
        onSaved?.();
        // Clear the workspace shortly after a clean save.
        setTimeout(resetAll, 1200);
      } else {
        setSaveMsg({ text: `Saved ${ok} of ${total}. Check the cards marked in red and try again.` });
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
          {name}{uncertain && <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] font-bold text-amber-800">check</span>}
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
        <div className="text-base font-bold text-[#0d2a63]">Add lead cards</div>
        {(hasCards || previews.length > 0) && (
          <button type="button" onClick={resetAll} className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50">
            ← Start over
          </button>
        )}
      </div>
      <p className="mb-3 text-xs text-gray-500">
        Snap a photo — or upload one from your files — of the Home Depot water-test cards and the scanner reads them for you, then check and save.
        You can photograph <strong>several cards at once</strong> (side by side, or one photo per card) and each becomes its own lead.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        {/* No `capture` attribute: leaving it off lets the device offer Take Photo,
            Photo Library AND Choose File, instead of forcing the camera. */}
        <input ref={fileRef} name="cardImage" type="file" accept="image/*" multiple onChange={onPick} className="text-sm" />
        <button type="button" onClick={scan} disabled={scanning}
          className="rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
          {scanning ? 'Reading…' : previews.length > 1 ? `Read ${previews.length} photos` : 'Read the cards'}
        </button>
        {!hasCards && (
          <button type="button" onClick={addBlankCard} className="text-sm text-gray-500 hover:underline">
            or enter by hand
          </button>
        )}
      </div>

      {previews.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {previews.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={src} alt={`Photo ${i + 1}`} className="h-20 w-20 rounded-lg border border-gray-200 object-cover" />
          ))}
        </div>
      )}

      {scanError && (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{scanError}</p>
      )}
      {hasCards && cards.length > 1 && (
        <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          Found {cards.length} cards. Check each one and save them all.
        </p>
      )}

      {hasCards && (
        <div className="mt-4 space-y-3">
          {cards.map((c, idx) => {
            const open = openIdx.has(idx);
            const title = c.customerName.trim() || c.phone.trim() || 'Untitled card';
            return (
              <div key={idx} className={`rounded-xl border ${c.saved ? 'border-green-300 bg-green-50/40' : c.error ? 'border-red-300' : 'border-gray-200'}`}>
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <button type="button" onClick={() => toggleOpen(idx)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">{idx + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-gray-900">{title}</span>
                      <span className="block truncate text-xs text-gray-500">
                        {[c.phone, c.city, c.storeNumber && `Store ${c.storeNumber}`].filter(Boolean).join(' · ') || 'No details yet'}
                      </span>
                    </span>
                    {c.saved && <span className="flex-none rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">Saved</span>}
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
                    {field(idx, 'customerName', 'Customer name')}
                    {field(idx, 'phone', 'Phone')}
                    {field(idx, 'address', 'Address', { wide: true })}
                    {field(idx, 'city', 'City')}
                    {field(idx, 'postalCode', 'Postal code')}
                    {field(idx, 'occupation', 'Occupation')}
                    {field(idx, 'bestTimeToContact', 'Best time to contact')}
                    {field(idx, 'storeNumber', 'Store #')}
                    {field(idx, 'collectedOn', 'Date collected')}
                    {field(idx, 'spouseName', 'Spouse name')}
                    {field(idx, 'spousePhone', 'Spouse phone')}
                    {field(idx, 'generatorName', 'Collected by (rep)')}

                    <div>
                      <label className={label} htmlFor={`sl_${idx}_ownsHome`}>Owns home</label>
                      <select id={`sl_${idx}_ownsHome`} value={c.ownsHome} onChange={(e) => setField(idx, 'ownsHome', e.target.value)} className="input">
                        <option value="UNKNOWN">Unknown</option><option value="OWN">Owns</option><option value="RENT">Rents</option><option value="WITH_PARENTS">With parents</option>
                      </select>
                    </div>
                    <div>
                      <label className={label} htmlFor={`sl_${idx}_waterSource`}>Water source</label>
                      <select id={`sl_${idx}_waterSource`} value={c.waterSource} onChange={(e) => setField(idx, 'waterSource', e.target.value)} className="input">
                        <option value="">—</option><option>City</option><option>Well</option><option>Other</option>
                      </select>
                    </div>
                    <div>
                      <label className={label} htmlFor={`sl_${idx}_waterQuality`}>Water quality</label>
                      <select id={`sl_${idx}_waterQuality`} value={c.waterQuality} onChange={(e) => setField(idx, 'waterQuality', e.target.value)} className="input">
                        <option value="">—</option><option>Excellent</option><option>Good</option><option>Fair</option><option>Poor</option>
                      </select>
                    </div>
                    <div>
                      <label className={label} htmlFor={`sl_${idx}_buysBottledWater`}>Buys bottled water</label>
                      <select id={`sl_${idx}_buysBottledWater`} value={c.buysBottledWater} onChange={(e) => setField(idx, 'buysBottledWater', e.target.value)} className="input">
                        <option value="">—</option><option value="true">Yes</option><option value="false">No</option>
                      </select>
                    </div>
                    <div>
                      <label className={label} htmlFor={`sl_${idx}_hasFilters`}>Has filters now</label>
                      <select id={`sl_${idx}_hasFilters`} value={c.hasFilters} onChange={(e) => setField(idx, 'hasFilters', e.target.value)} className="input">
                        <option value="">—</option><option value="true">Yes</option><option value="false">No</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <span className={label}>Conditions experienced</span>
                      <div className="flex flex-wrap gap-3">
                        {CONDITION_OPTS.map((opt) => (
                          <label key={opt} className="flex items-center gap-1.5 text-sm text-gray-700">
                            <input type="checkbox" checked={c.conditions.includes(opt)}
                              onChange={(e) => setField(idx, 'conditions', e.target.checked ? [...c.conditions, opt] : c.conditions.filter((x) => x !== opt))}
                              className="h-4 w-4 rounded border-gray-300" />
                            {opt}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <label className={label} htmlFor={`sl_${idx}_waterNotes`}>Water notes</label>
                      <textarea id={`sl_${idx}_waterNotes`} value={c.waterNotes} onChange={(e) => setField(idx, 'waterNotes', e.target.value)} rows={2} className="input" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={label} htmlFor={`sl_${idx}_note`}>Internal note (optional)</label>
                      <textarea id={`sl_${idx}_note`} value={c.note} onChange={(e) => setField(idx, 'note', e.target.value)} rows={2} className="input" placeholder="Anything the office should know" />
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
              {saving ? 'Saving…' : unsaved > 1 ? `Save all ${unsaved} leads` : 'Save lead'}
            </button>
            <button type="button" onClick={addBlankCard} className="text-sm text-gray-500 hover:underline">+ Add another card</button>
            <button type="button" onClick={resetAll} className="text-sm text-gray-500 hover:underline">Cancel</button>
            {saveMsg && <span className={`text-sm ${saveMsg.ok ? 'text-green-700' : 'text-red-600'}`}>{saveMsg.text}</span>}
          </div>
        </div>
      )}
      {!hasCards && saveMsg?.ok && <p className="mt-3 text-sm text-green-700">{saveMsg.text}</p>}
    </div>
  );
}
