'use client';

import { useFormStatus } from 'react-dom';

function Label({ label, small }: { label: string; small: boolean }) {
  const { pending } = useFormStatus();
  return <span className={small ? 'text-[11px]' : 'text-sm'}>{pending ? 'Uploading…' : label}</span>;
}

/**
 * "Change / add photo" control for an ID-tag person's headshot. Shared by the
 * dealer list and the reviewer detail view — each passes its own server action.
 * Clicking opens the file picker and auto-submits the chosen image.
 */
export function IdTagHeadshotButton({
  id, action, label = 'Change photo', small = false,
}: {
  id: string;
  action: (formData: FormData) => Promise<void>;
  label?: string;
  small?: boolean;
}) {
  const base = small
    ? 'inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-50'
    : 'inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50';
  return (
    <form action={action} className="inline-block">
      <input type="hidden" name="id" value={id} />
      <label className={base}>
        📷 <Label label={label} small={small} />
        <input name="headshot" type="file" accept="image/*" className="hidden"
          onChange={(e) => e.currentTarget.form?.requestSubmit()} />
      </label>
    </form>
  );
}
