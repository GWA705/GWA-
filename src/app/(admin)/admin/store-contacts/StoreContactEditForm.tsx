'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { saveStoreContactAction, type ContactsActionState } from './actions';

const emailsIn = (t: string) =>
  Array.from(new Set((t.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || []).map((e) => e.toLowerCase())));

// React 18 has no useActionState — pending comes from useFormStatus.
function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
      {pending ? 'Saving…' : 'Save store'}
    </button>
  );
}

export interface StoreInit {
  storeNumber: string;
  storeName: string;
  district: string;
  storeContacts: string;
  ism: string;
  distributor: string;
  officeManager: string;
  active: boolean;
  isNew: boolean;
}

export function StoreContactEditForm({ init }: { init: StoreInit }) {
  const [state, action] = useFormState<ContactsActionState, FormData>(saveStoreContactAction, {});
  const [sc, setSc] = useState(init.storeContacts);
  const [ism, setIsm] = useState(init.ism);
  const [dist, setDist] = useState(init.distributor);
  const [om, setOm] = useState(init.officeManager);

  const to = Array.from(new Set([...emailsIn(sc), ...emailsIn(dist), ...emailsIn(om)]));
  const cc = emailsIn(ism).filter((e) => !to.includes(e));

  const Area = ({ name, label, hint, value, onChange }: { name: string; label: string; hint: string; value: string; onChange: (v: string) => void }) => (
    <div>
      <label className="block text-sm font-semibold text-gray-800">{label}</label>
      <p className="mb-1 text-xs text-gray-500">{hint}</p>
      <textarea name={name} value={value} onChange={(e) => onChange(e.target.value)} rows={4} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono" />
    </div>
  );

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="block text-sm font-semibold text-gray-800">Store #</label>
          <input name="storeNumber" defaultValue={init.storeNumber} readOnly={!init.isNew} placeholder="7024"
            className={`mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm ${!init.isNew ? 'bg-gray-50 text-gray-500' : ''}`} />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-800">Store name</label>
          <input name="storeName" defaultValue={init.storeName} placeholder="Barrie" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-800">District</label>
          <input name="district" defaultValue={init.district} placeholder="Central Ontario" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
      </div>

      <Area name="storeContacts" label="Store contacts (Home Depot)" hint="Store managers / ASM / pro desk — names & emails, one per line. Goes on the To line." value={sc} onChange={setSc} />
      <Area name="ism" label="ISM" hint="Home Depot ISM. Goes on the Cc line." value={ism} onChange={setIsm} />
      <Area name="distributor" label="Distributor" hint="Your distributor / lead office. On the To line." value={dist} onChange={setDist} />
      <Area name="officeManager" label="Office manager" hint="Office manager(s). On the To line." value={om} onChange={setOm} />

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" name="active" defaultChecked={init.active} /> Active (include this store in the weekly send)
      </label>

      <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs">
        <div className="font-semibold text-gray-700">This store's report will send to:</div>
        <div className="mt-1"><span className="font-semibold text-gray-600">To:</span> {to.length ? to.join(', ') : <span className="text-gray-400">— none —</span>}</div>
        <div className="mt-0.5"><span className="font-semibold text-gray-600">Cc:</span> {cc.length ? cc.join(', ') : <span className="text-gray-400">— none —</span>}</div>
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex gap-2">
        <SaveButton />
      </div>
    </form>
  );
}
