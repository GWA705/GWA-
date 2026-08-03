'use client';

import { useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { createContentAction, updateContentAction, type ActionState } from '@/app/(admin)/actions';
import { FileDropInput } from '@/components/FileDropInput';

const SECTIONS = [
  { value: 'RESOURCE', label: 'Resources' },
  { value: 'HD_PROMOTION', label: 'HD Promotions' },
  { value: 'HD_CREDIT_CARD', label: 'HD Credit Card' },
];

export interface ContentItemLite {
  id: string;
  section: string;
  title: string;
  body: string | null;
  linkUrl: string | null;
  sortOrder: number;
  fileName: string | null;
}

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Post item'}
    </button>
  );
}

export function ContentForm({ defaultSection, item }: { defaultSection?: string; item?: ContentItemLite }) {
  const isEdit = !!item;
  const boundAction = isEdit ? updateContentAction.bind(null, item!.id) : createContentAction;
  const [state, action] = useFormState(boundAction, {} as ActionState);
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      action={async (fd) => {
        await action(fd);
        if (!isEdit) ref.current?.reset(); // keep values when editing
      }}
      className="space-y-4"
    >
      {state.error && <div className="rounded-md bg-red-50 p-2 text-sm text-red-700">{state.error}</div>}
      {state.ok && <div className="rounded-md bg-green-50 p-2 text-sm text-green-700">{isEdit ? 'Changes saved.' : 'Item posted.'}</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={`section-${item?.id ?? 'new'}`}>Tab</label>
          <select id={`section-${item?.id ?? 'new'}`} name="section" defaultValue={item?.section || defaultSection || 'RESOURCE'} className="input">
            {SECTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor={`sortOrder-${item?.id ?? 'new'}`}>Sort order <span className="font-normal text-gray-400">(lower shows first)</span></label>
          <input id={`sortOrder-${item?.id ?? 'new'}`} name="sortOrder" type="number" defaultValue={item?.sortOrder ?? 0} className="input" />
        </div>
      </div>

      <div>
        <label className="label" htmlFor={`title-${item?.id ?? 'new'}`}>Title</label>
        <input id={`title-${item?.id ?? 'new'}`} name="title" required defaultValue={item?.title ?? ''} className="input" placeholder="e.g. Spring HVAC promotion" />
      </div>
      <div>
        <label className="label" htmlFor={`body-${item?.id ?? 'new'}`}>Details <span className="font-normal text-gray-400">(optional)</span></label>
        <textarea id={`body-${item?.id ?? 'new'}`} name="body" rows={4} defaultValue={item?.body ?? ''} className="input" placeholder="What dealers should know…" />
      </div>
      <div>
        <label className="label" htmlFor={`linkUrl-${item?.id ?? 'new'}`}>Link <span className="font-normal text-gray-400">(optional)</span></label>
        <input id={`linkUrl-${item?.id ?? 'new'}`} name="linkUrl" defaultValue={item?.linkUrl ?? ''} className="input" placeholder="https://…" />
      </div>
      <div>
        <label className="label">Attachment <span className="font-normal text-gray-400">(optional)</span></label>
        {item?.fileName && (
          <p className="mb-1 truncate text-xs text-gray-500">Current: 📎 {item.fileName}</p>
        )}
        <FileDropInput name="file" accept=".pdf,.jpg,.jpeg,.png,.webp" multiple={false} variant="compact" hint={item?.fileName ? 'Upload to replace the current file' : 'PDF, JPG, PNG, or WEBP'} />
        {item?.fileName && (
          <label className="mt-1 flex items-center gap-2 text-xs text-gray-500">
            <input type="checkbox" name="removeFile" className="h-3.5 w-3.5" />
            Remove current attachment
          </label>
        )}
      </div>
      {!isEdit && (
        <div>
          <label className="label">Cover thumbnail <span className="font-normal text-gray-400">(optional — shown on the card)</span></label>
          <FileDropInput name="thumb" accept=".jpg,.jpeg,.png,.webp" multiple={false} variant="compact" hint="JPG, PNG, or WEBP" buttonLabel="Choose image" />
        </div>
      )}
      <SubmitButton isEdit={isEdit} />
    </form>
  );
}
