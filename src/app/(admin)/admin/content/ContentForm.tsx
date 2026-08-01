'use client';

import { useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { createContentAction, type ActionState } from '@/app/(admin)/actions';
import { FileDropInput } from '@/components/FileDropInput';

const SECTIONS = [
  { value: 'RESOURCE', label: 'Resources' },
  { value: 'HD_PROMOTION', label: 'HD Promotions' },
  { value: 'HD_CREDIT_CARD', label: 'HD Credit Card' },
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Posting…' : 'Post item'}
    </button>
  );
}

export function ContentForm({ defaultSection }: { defaultSection?: string }) {
  const [state, action] = useFormState(createContentAction, {} as ActionState);
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      action={async (fd) => {
        await action(fd);
        ref.current?.reset();
      }}
      className="space-y-4"
    >
      {state.error && <div className="rounded-md bg-red-50 p-2 text-sm text-red-700">{state.error}</div>}
      {state.ok && <div className="rounded-md bg-green-50 p-2 text-sm text-green-700">Item posted.</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="section">Tab</label>
          <select id="section" name="section" defaultValue={defaultSection || 'RESOURCE'} className="input">
            {SECTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="sortOrder">Sort order <span className="font-normal text-gray-400">(lower shows first)</span></label>
          <input id="sortOrder" name="sortOrder" type="number" defaultValue={0} className="input" />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="title">Title</label>
        <input id="title" name="title" required className="input" placeholder="e.g. Spring HVAC promotion" />
      </div>
      <div>
        <label className="label" htmlFor="body">Details <span className="font-normal text-gray-400">(optional)</span></label>
        <textarea id="body" name="body" rows={4} className="input" placeholder="What dealers should know…" />
      </div>
      <div>
        <label className="label" htmlFor="linkUrl">Link <span className="font-normal text-gray-400">(optional)</span></label>
        <input id="linkUrl" name="linkUrl" className="input" placeholder="https://…" />
      </div>
      <div>
        <label className="label">Attachment <span className="font-normal text-gray-400">(optional)</span></label>
        <FileDropInput name="file" accept=".pdf,.jpg,.jpeg,.png,.webp" multiple={false} variant="compact" hint="PDF, JPG, PNG, or WEBP" />
      </div>
      <div>
        <label className="label">Cover thumbnail <span className="font-normal text-gray-400">(optional — shown on the card)</span></label>
        <FileDropInput name="thumb" accept=".jpg,.jpeg,.png,.webp" multiple={false} variant="compact" hint="JPG, PNG, or WEBP" buttonLabel="Choose image" />
      </div>
      <SubmitButton />
    </form>
  );
}
