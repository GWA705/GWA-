'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createScannedLeadAction } from '@/app/(dealer)/dealer/leads/scanActions';

// Mirrors leadScanner.ts CardExtraction (kept local — no server import).
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
}
interface ExtractResult { available: boolean; data?: CardExtraction; raw?: string; error?: string }

type Form = {
  customerName: string; phone: string; occupation: string;
  spouseName: string; spousePhone: string; spouseOccupation: string;
  address: string; city: string; postalCode: string;
  storeNumber: string; collectedOn: string; bestTimeToContact: string; generatorName: string;
  ownsHome: string; waterSource: string; waterQuality: string;
  buysBottledWater: string; hasFilters: string; hasWellWater: string;
  conditions: string[]; waterNotes: string; note: string;
};

const EMPTY: Form = {
  customerName: '', phone: '', occupation: '', spouseName: '', spousePhone: '', spouseOccupation: '',
  address: '', city: '', postalCode: '', storeNumber: '', collectedOn: '', bestTimeToContact: '', generatorName: '',
  ownsHome: 'UNKNOWN', waterSource: '', waterQuality: '', buysBottledWater: '', hasFilters: '', hasWellWater: '',
  conditions: [], waterNotes: '', note: '',
};

const CONDITION_OPTS = ['Taste', 'Odors', 'Scale build up', 'Stains'];
const boolToStr = (b: boolean | null) => (b === true ? 'true' : b === false ? 'false' : '');

export function ScanLeadCard({ onSaved }: { onSaved?: () => void }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [rawJson, setRawJson] = useState('');
  const [confidence, setConfidence] = useState<number | null>(null);
  const [uncertain, setUncertain] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, startSave] = useTransition();
  const [saveMsg, setSaveMsg] = useState<{ ok?: boolean; text: string } | null>(null);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const isUncertain = (k: string) => uncertain.includes(k);

  function onPick() {
    const files = Array.from(fileRef.current?.files ?? []);
    setPreviews((old) => { old.forEach((u) => URL.revokeObjectURL(u)); return files.map((f) => URL.createObjectURL(f)); });
    setResult(null);
    setSaveMsg(null);
  }

  async function scan() {
    const files = Array.from(fileRef.current?.files ?? []);
    if (files.length === 0) { setResult({ available: true, error: 'Choose a photo of the card first.' }); setShowForm(true); return; }
    const fd = new FormData();
    for (const f of files) fd.append('cardImage', f);
    setScanning(true);
    setSaveMsg(null);
    try {
      const res = await fetch('/api/leads/scan-card', { method: 'POST', body: fd });
      const json: ExtractResult = await res.json();
      setResult(json);
      if (json.data) {
        const d = json.data;
        setForm({
          customerName: d.name ?? '', phone: d.phone ?? '', occupation: d.occupation ?? '',
          spouseName: d.spouseName ?? '', spousePhone: d.spousePhone ?? '', spouseOccupation: d.spouseOccupation ?? '',
          address: d.address ?? '', city: d.city ?? '', postalCode: d.postalCode ?? '',
          storeNumber: d.storeNumber ?? '', collectedOn: d.collectedOn ?? '', bestTimeToContact: d.bestTimeToContact ?? '',
          generatorName: d.generatorName ?? '', ownsHome: d.ownsHome ?? 'UNKNOWN', waterSource: d.waterSource ?? '',
          waterQuality: d.waterQuality ?? '', buysBottledWater: boolToStr(d.buysBottledWater), hasFilters: boolToStr(d.hasFilters),
          hasWellWater: boolToStr(d.hasWellWater), conditions: d.conditions ?? [], waterNotes: d.waterNotes ?? '', note: '',
        });
        setRawJson(json.raw ?? '');
        setConfidence(typeof d.confidence === 'number' ? d.confidence : null);
        setUncertain(d.uncertainFields ?? []);
      }
      setShowForm(true);
    } catch {
      setResult({ available: true, error: 'Could not reach the card reader. Type the card in instead.' });
      setShowForm(true);
    } finally {
      setScanning(false);
    }
  }

  function save() {
    if (!form.customerName.trim() && !form.phone.trim()) {
      setSaveMsg({ text: 'Enter at least a name or a phone number.' });
      return;
    }
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => {
      if (k === 'conditions') fd.append('conditions', JSON.stringify(v));
      else fd.append(k, String(v));
    });
    fd.append('uncertainFields', JSON.stringify(uncertain));
    if (rawJson) fd.append('rawJson', rawJson);
    if (confidence != null) fd.append('confidence', String(confidence));
    const primary = fileRef.current?.files?.[0];
    if (primary) fd.append('photo', primary);

    startSave(async () => {
      const r = await createScannedLeadAction({}, fd);
      if (r.ok) {
        setSaveMsg({ ok: true, text: 'Lead saved.' });
        setForm(EMPTY); setResult(null); setShowForm(false); setConfidence(null); setUncertain([]); setRawJson('');
        setPreviews((old) => { old.forEach((u) => URL.revokeObjectURL(u)); return []; });
        if (fileRef.current) fileRef.current.value = '';
        router.refresh();
        onSaved?.();
      } else {
        setSaveMsg({ text: r.error ?? 'Could not save the lead.' });
      }
    });
  }

  const label = 'block text-xs font-semibold text-gray-600 mb-1';
  const field = (k: keyof Form, name: string, opts?: { wide?: boolean }) => (
    <div className={opts?.wide ? 'sm:col-span-2' : ''}>
      <label className={label} htmlFor={`sl_${k}`}>
        {name}{isUncertain(k as string) && <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] font-bold text-amber-800">check</span>}
      </label>
      <input id={`sl_${k}`} value={form[k] as string} onChange={(e) => set(k, e.target.value as Form[typeof k])}
        className={`input ${isUncertain(k as string) ? 'ring-2 ring-amber-300' : ''}`} />
    </div>
  );

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-1 text-base font-bold text-[#0d2a63]">Add a lead card</div>
      <p className="mb-3 text-xs text-gray-500">
        Snap a photo of a Home Depot water-test lead card and the scanner reads it for you — then check the fields and save.
        Add more than one photo of the <strong>same</strong> card (a clearer reshoot or a close-up) for a better read.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <input ref={fileRef} name="cardImage" type="file" accept="image/*" capture="environment" multiple onChange={onPick} className="text-sm" />
        <button type="button" onClick={scan} disabled={scanning}
          className="rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
          {scanning ? 'Reading…' : previews.length > 1 ? `Read ${previews.length} photos` : 'Read the card'}
        </button>
        {!showForm && (
          <button type="button" onClick={() => { setForm(EMPTY); setShowForm(true); }} className="text-sm text-gray-500 hover:underline">
            or enter by hand
          </button>
        )}
      </div>

      {previews.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {previews.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={src} alt={`Card ${i + 1}`} className="h-20 w-20 rounded-lg border border-gray-200 object-cover" />
          ))}
        </div>
      )}

      {result?.error && (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{result.error}</p>
      )}
      {result?.data && confidence != null && (
        <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          Read with {confidence}% confidence.{uncertain.length > 0 && ` Double-check the highlighted field${uncertain.length === 1 ? '' : 's'}.`}
        </p>
      )}

      {showForm && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {field('customerName', 'Customer name')}
          {field('phone', 'Phone')}
          {field('address', 'Address', { wide: true })}
          {field('city', 'City')}
          {field('postalCode', 'Postal code')}
          {field('occupation', 'Occupation')}
          {field('bestTimeToContact', 'Best time to contact')}
          {field('storeNumber', 'Store #')}
          {field('collectedOn', 'Date collected')}
          {field('spouseName', 'Spouse name')}
          {field('spousePhone', 'Spouse phone')}
          {field('generatorName', 'Collected by (rep)')}

          <div>
            <label className={label} htmlFor="sl_ownsHome">Owns home</label>
            <select id="sl_ownsHome" value={form.ownsHome} onChange={(e) => set('ownsHome', e.target.value)} className="input">
              <option value="UNKNOWN">Unknown</option><option value="OWN">Owns</option><option value="RENT">Rents</option><option value="WITH_PARENTS">With parents</option>
            </select>
          </div>
          <div>
            <label className={label} htmlFor="sl_waterSource">Water source</label>
            <select id="sl_waterSource" value={form.waterSource} onChange={(e) => set('waterSource', e.target.value)} className="input">
              <option value="">—</option><option>City</option><option>Well</option><option>Other</option>
            </select>
          </div>
          <div>
            <label className={label} htmlFor="sl_waterQuality">Water quality</label>
            <select id="sl_waterQuality" value={form.waterQuality} onChange={(e) => set('waterQuality', e.target.value)} className="input">
              <option value="">—</option><option>Excellent</option><option>Good</option><option>Fair</option><option>Poor</option>
            </select>
          </div>
          <div>
            <label className={label} htmlFor="sl_buysBottledWater">Buys bottled water</label>
            <select id="sl_buysBottledWater" value={form.buysBottledWater} onChange={(e) => set('buysBottledWater', e.target.value)} className="input">
              <option value="">—</option><option value="true">Yes</option><option value="false">No</option>
            </select>
          </div>
          <div>
            <label className={label} htmlFor="sl_hasFilters">Has filters now</label>
            <select id="sl_hasFilters" value={form.hasFilters} onChange={(e) => set('hasFilters', e.target.value)} className="input">
              <option value="">—</option><option value="true">Yes</option><option value="false">No</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <span className={label}>Conditions experienced</span>
            <div className="flex flex-wrap gap-3">
              {CONDITION_OPTS.map((c) => (
                <label key={c} className="flex items-center gap-1.5 text-sm text-gray-700">
                  <input type="checkbox" checked={form.conditions.includes(c)}
                    onChange={(e) => set('conditions', e.target.checked ? [...form.conditions, c] : form.conditions.filter((x) => x !== c))}
                    className="h-4 w-4 rounded border-gray-300" />
                  {c}
                </label>
              ))}
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className={label} htmlFor="sl_waterNotes">Water notes</label>
            <textarea id="sl_waterNotes" value={form.waterNotes} onChange={(e) => set('waterNotes', e.target.value)} rows={2} className="input" />
          </div>
          <div className="sm:col-span-2">
            <label className={label} htmlFor="sl_note">Internal note (optional)</label>
            <textarea id="sl_note" value={form.note} onChange={(e) => set('note', e.target.value)} rows={2} className="input" placeholder="Anything the office should know" />
          </div>

          <div className="sm:col-span-2 flex flex-wrap items-center gap-3 pt-1">
            <button type="button" onClick={save} disabled={saving}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
              {saving ? 'Saving…' : 'Save lead'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setResult(null); setSaveMsg(null); }} className="text-sm text-gray-500 hover:underline">Cancel</button>
            {saveMsg && <span className={`text-sm ${saveMsg.ok ? 'text-green-700' : 'text-red-600'}`}>{saveMsg.text}</span>}
          </div>
        </div>
      )}
      {!showForm && saveMsg?.ok && <p className="mt-3 text-sm text-green-700">{saveMsg.text}</p>}
    </div>
  );
}
