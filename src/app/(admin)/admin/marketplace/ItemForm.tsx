'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { saveItemAction, type ItemActionState } from './actions';
import { MARKETPLACE_TAGS } from '@/lib/constants';

interface Item {
  id: string;
  name: string;
  description: string | null;
  options: string[];
  sortOrder: number;
  active: boolean;
  featured?: boolean;
  tags?: string[];
  hasImage?: boolean;
  categoryId?: string | null;
  kind?: string;
  hasFile?: boolean;
  fileName?: string | null;
}

interface CategoryOption {
  id: string;
  name: string;
}

const initial: ItemActionState = {};

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Add item'}
    </button>
  );
}

export function ItemForm({ item, categories }: { item?: Item; categories: CategoryOption[] }) {
  const [state, action] = useFormState(saveItemAction, initial);
  const isEdit = !!item;
  const formRef = useRef<HTMLFormElement>(null);
  const [kind, setKind] = useState<string>(item?.kind === 'DOWNLOAD' ? 'DOWNLOAD' : 'ORDER');
  const isDownload = kind === 'DOWNLOAD';

  // Clear the "Add an item" form (including the file input) after a successful
  // add so it's ready for the next one. Edit forms keep their values.
  useEffect(() => {
    if (state.ok && !isEdit) {
      formRef.current?.reset();
      setKind('ORDER');
    }
  }, [state, isEdit]);

  return (
    <form ref={formRef} action={action} className="space-y-3">
      {item && <input type="hidden" name="id" value={item.id} />}
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Name</label>
          <input name="name" defaultValue={item?.name ?? ''} className="input" />
        </div>
        <div>
          <label className="label">Category</label>
          <select name="categoryId" defaultValue={item?.categoryId ?? ''} className="input">
            <option value="">— Uncategorized —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="label">Type</label>
        <select name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className="input">
          <option value="ORDER">Orderable item (dealers choose a quantity)</option>
          <option value="DOWNLOAD">Downloadable file (dealers download it)</option>
        </select>
      </div>
      {isDownload ? (
        <div>
          <label className="label">File <span className="font-normal text-gray-400">(PDF, image, or ZIP — max 15&nbsp;MB)</span></label>
          {item?.hasFile && (
            <p className="mb-1 text-xs text-gray-500">
              Current file: <span className="font-medium text-gray-700">{item.fileName || 'attached'}</span>
            </p>
          )}
          <input name="file" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.zip,application/pdf,image/*,application/zip" className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100" />
          {item?.hasFile && (
            <label className="mt-2 flex items-center gap-2 text-xs text-gray-500">
              <input type="checkbox" name="removeFile" className="h-3.5 w-3.5" />
              Remove current file
            </label>
          )}
        </div>
      ) : (
        <div>
          <label className="label">Options <span className="font-normal text-gray-400">(sizes, comma-separated — optional)</span></label>
          <input name="options" defaultValue={item?.options.join(', ') ?? ''} className="input" placeholder="S, M, L, XL" />
        </div>
      )}
      <div>
        <label className="label">Description <span className="font-normal text-gray-400">(optional)</span></label>
        <textarea name="description" defaultValue={item?.description ?? ''} rows={2} className="input" />
      </div>
      <div>
        <label className="label">Photo <span className="font-normal text-gray-400">(optional thumbnail — auto-sized on upload)</span></label>
        <div className="flex items-center gap-3">
          {item?.hasImage && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={`/api/marketplace/items/${item.id}/image`} alt="" className="h-14 w-14 rounded object-cover ring-1 ring-gray-200" />
          )}
          <input name="image" type="file" accept="image/*" className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100" />
        </div>
        {item?.hasImage && (
          <label className="mt-2 flex items-center gap-2 text-xs text-gray-500">
            <input type="checkbox" name="removeImage" className="h-3.5 w-3.5" />
            Remove current photo
          </label>
        )}
      </div>
      <div className="rounded-md border border-gray-200 p-3">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
          <input type="checkbox" name="featured" defaultChecked={item?.featured ?? false} className="h-4 w-4" />
          ✨ Feature in New Arrivals
        </label>
        <p className="mt-1 text-xs text-gray-500">Shows this item in the scrolling strip at the top of the marketplace. It keeps its normal category too.</p>
        <div className="mt-3">
          <span className="label">Tags <span className="font-normal text-gray-400">(shown as badges)</span></span>
          <div className="mt-1 flex flex-wrap gap-3">
            {MARKETPLACE_TAGS.map((t) => (
              <label key={t.key} className="flex items-center gap-1.5 text-sm text-gray-700">
                <input type="checkbox" name="tags" value={t.key} defaultChecked={item?.tags?.includes(t.key) ?? false} className="h-4 w-4" />
                <span className={`badge ${t.badgeClass}`}>{t.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="w-28">
          <label className="label">Sort order</label>
          <input name="sortOrder" type="number" defaultValue={item?.sortOrder ?? 0} className="input" />
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm text-gray-700">
          <input type="checkbox" name="active" defaultChecked={item ? item.active : true} className="h-4 w-4" />
          Active (visible to dealers)
        </label>
        <div className="ml-auto flex items-center gap-3">
          {state.ok && <span className="text-xs text-green-600">✓ {isEdit ? 'Saved' : 'Added'}</span>}
          <SubmitButton isEdit={isEdit} />
        </div>
      </div>
    </form>
  );
}
