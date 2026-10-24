'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { toggleUserActiveAction, deleteUserAction, resendWelcomeEmailAction } from '@/app/(admin)/actions';

export function UserRowActions({
  id,
  name,
  active,
  canDelete,
}: {
  id: string;
  name: string;
  active: boolean;
  canDelete: boolean;
}) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  // Re-send the getting-started email. If the person has already signed in, the
  // action asks us to confirm (resending resets their password).
  function resend(confirmReset = false) {
    start(async () => {
      const res = await resendWelcomeEmailAction(id, 'en', confirmReset);
      if (res.needsConfirm) {
        if (window.confirm(`${res.error}\n\nContinue and reset their password?`)) resend(true);
        return;
      }
      setNote({ ok: !!res.ok, text: res.message || res.error || '' });
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-2">
        <Link href={`/admin/users/${id}/edit`} className="btn-secondary text-xs">Edit</Link>
        <button
          type="button"
          disabled={pending}
          className="btn-secondary text-xs"
          onClick={() => resend(false)}
          title="Re-send this person their getting-started email (with a new temporary password)"
        >
          {pending ? 'Sending…' : 'Resend welcome'}
        </button>
        <form action={toggleUserActiveAction.bind(null, id)}>
          <button type="submit" className="btn-secondary text-xs">
            {active ? 'Archive' : 'Unarchive'}
          </button>
        </form>
        {canDelete ? (
          <form
            action={deleteUserAction.bind(null, id)}
            onSubmit={(e) => {
              if (!window.confirm(`Delete “${name}” permanently? This cannot be undone.`)) {
                e.preventDefault();
              }
            }}
          >
            <button type="submit" className="btn-danger text-xs">Delete</button>
          </form>
        ) : (
          <span
            className="cursor-help text-xs text-gray-400"
            title="Only users with no activity (no deals, documents, notes, or history) can be deleted. Archive this user instead."
          >
            Archive only
          </span>
        )}
      </div>
      {note && (
        <span className={`max-w-xs text-right text-xs ${note.ok ? 'text-green-700' : 'text-red-600'}`}>{note.text}</span>
      )}
    </div>
  );
}
