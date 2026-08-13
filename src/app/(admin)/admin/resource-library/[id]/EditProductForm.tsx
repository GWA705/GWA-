'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { updateResourceProductAction, type ActionState } from '../actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Saving…' : 'Save details'}
    </button>
  );
}

export function EditProductForm({
  product,
  hasImage,
}: {
  product: { id: string; title: string; category: string | null; brand: string | null; modelNumber: string | null; description: string | null };
  hasImage: boolean;
}) {
  const [state, action] = useFormState(updateResourceProductAction.bind(null, product.id), {} as ActionState);
  return (
    <form action={action} className="space-y-4">
      {state.error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{state.error}</div>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="title">Product name</label>
          <input id="title" name="title" required defaultValue={product.title} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="category">Category</label>
          <input id="category" name="category" defaultValue={product.category ?? ''} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="brand">Brand</label>
          <input id="brand" name="brand" defaultValue={product.brand ?? ''} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="modelNumber">Model #</label>
          <input id="modelNumber" name="modelNumber" defaultValue={product.modelNumber ?? ''} className="input" />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="description">Description</label>
          <textarea id="description" name="description" rows={3} defaultValue={product.description ?? ''} className="input" />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="image">Product photo {hasImage && <span className="font-normal text-gray-400">(upload to replace)</span>}</label>
          <input id="image" name="image" type="file" accept="image/*" className="input" />
          {hasImage && (
            <label className="mt-2 flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" name="removeImage" className="rounded border-gray-300" /> Remove current photo
            </label>
          )}
        </div>
      </div>
      <SubmitButton />
    </form>
  );
}
