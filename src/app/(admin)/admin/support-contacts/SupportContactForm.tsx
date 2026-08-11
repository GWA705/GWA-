'use client';

import { useEffect, useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

interface State { ok?: boolean; error?: string }
type Action = (prev: State, fd: FormData) => Promise<State>;

export interface ContactValues {
  id?: string;
  name?: string | null;
  title?: string | null;
  phone?: string | null;
  altPhone?: string | null;
  email?: string | null;
  hours?: string | null;
  website?: string | null;
  notes?: string | null;
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn-primary text-sm" disabled={pending}>{pending ? 'Saving…' : label}</button>;
}

export function SupportContactForm({
  action,
  values = {},
  logoUrl,
  submitLabel = 'Add contact',
  onDone,
  compact = false,
}: {
  action: Action;
  values?: ContactValues;
  logoUrl?: string | null;
  submitLabel?: string;
  onDone?: () => void;
  compact?: boolean;
}) {
  const [state, formAction] = useFormState(action, {} as State);
  const ref = useRef<HTMLFormElement>(null);
  // Close an inline edit form once the save succeeds (effect, not during render).
  useEffect(() => {
    if (state.ok && values.id && onDone) onDone();
  }, [state.ok, values.id, onDone]);
  return (
    <form
      ref={ref}
      action={async (fd) => {
        await formAction(fd);
        if (!values.id) ref.current?.reset(); // clear only the create form
      }}
      className="space-y-3"
    >
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Name</label>
          <input name="name" defaultValue={values.name ?? ''} className="input" placeholder="Georgian Water and Air" required />
        </div>
        <div>
          <label className="label">Title / department</label>
          <input name="title" defaultValue={values.title ?? ''} className="input" placeholder="Main office / Billing" />
        </div>
        <div>
          <label className="label">Phone</label>
          <input name="phone" defaultValue={values.phone ?? ''} className="input" placeholder="705-812-0320" />
        </div>
        <div>
          <label className="label">Alternate phone</label>
          <input name="altPhone" defaultValue={values.altPhone ?? ''} className="input" placeholder="1-866-840-2789" />
        </div>
        <div>
          <label className="label">Email</label>
          <input name="email" type="email" defaultValue={values.email ?? ''} className="input" placeholder="office@ghsbarrie.ca" />
        </div>
        <div>
          <label className="label">Website</label>
          <input name="website" defaultValue={values.website ?? ''} className="input" placeholder="https://…" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Hours</label>
          <input name="hours" defaultValue={values.hours ?? ''} className="input" placeholder="Mon–Fri 11am–7:30pm" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Notes (optional)</label>
          <textarea name="notes" rows={2} defaultValue={values.notes ?? ''} className="input" placeholder="Anything else dealers should know" />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor={`logo-${values.id ?? 'new'}`}>Logo / photo (optional)</label>
          <div className="flex items-center gap-3">
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="h-12 w-12 flex-none rounded-lg border border-gray-200 object-contain" />
            )}
            <input id={`logo-${values.id ?? 'new'}`} name="logo" type="file" accept="image/png,image/jpeg,image/webp" className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100" />
          </div>
          {logoUrl && (
            <label className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
              <input type="checkbox" name="removeLogo" className="h-3.5 w-3.5" /> Remove current logo
            </label>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Submit label={submitLabel} />
        {onDone && <button type="button" className="btn-secondary text-sm" onClick={onDone}>Cancel</button>}
        {state.error && <span className="text-xs text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
