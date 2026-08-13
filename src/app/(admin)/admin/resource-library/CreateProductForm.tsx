'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { createResourceProductAction, type ActionState } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Adding…' : 'Add product'}
    </button>
  );
}

export function CreateProductForm() {
  const [state, action] = useFormState(createResourceProductAction, {} as ActionState);
  return (
    <form action={action} className="space-y-4">
      {state.error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{state.error}</div>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="title">Product name</label>
          <input id="title" name="title" required className="input" placeholder="e.g. GWA Reverse Osmosis System" />
        </div>
        <div>
          <label className="label" htmlFor="category">Category <span className="font-normal text-gray-400">(optional)</span></label>
          <input id="category" name="category" className="input" placeholder="Water / Air / HVAC …" />
        </div>
        <div>
          <label className="label" htmlFor="brand">Brand <span className="font-normal text-gray-400">(optional)</span></label>
          <input id="brand" name="brand" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="modelNumber">Model # <span className="font-normal text-gray-400">(optional)</span></label>
          <input id="modelNumber" name="modelNumber" className="input" />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="description">Description <span className="font-normal text-gray-400">(optional)</span></label>
          <textarea id="description" name="description" rows={3} className="input" />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="image">Product photo <span className="font-normal text-gray-400">(optional — JPG/PNG/WEBP)</span></label>
          <input id="image" name="image" type="file" accept="image/*" className="input" />
        </div>
      </div>
      <p className="text-xs text-gray-500">You&apos;ll add manuals, brochures and other files on the next screen.</p>
      <SubmitButton />
    </form>
  );
}
