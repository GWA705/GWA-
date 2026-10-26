'use client';

import { useFormStatus } from 'react-dom';

function Btn({ small }: { small: boolean }) {
  const { pending } = useFormStatus();
  const cls = small
    ? 'rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50'
    : 'rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50';
  return <button type="submit" disabled={pending} className={cls}>{pending ? 'Deleting…' : 'Delete'}</button>;
}

/**
 * Delete an ID-tag record. Confirms first, then submits the given server action.
 * Shared by the admin board and the reviewer detail view.
 */
export function IdTagDeleteButton({ id, action, small = false }: { id: string; action: (formData: FormData) => Promise<void>; small?: boolean }) {
  return (
    <form
      action={action}
      onSubmit={(e) => { if (!confirm('Delete this ID-tag record? This also removes the headshot and card, and can’t be undone.')) e.preventDefault(); }}
    >
      <input type="hidden" name="id" value={id} />
      <Btn small={small} />
    </form>
  );
}
