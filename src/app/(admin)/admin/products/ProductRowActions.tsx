'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFormState } from 'react-dom';
import {
  renameProductAction,
  toggleProductActiveAction,
  deleteProductAction,
  moveProductAction,
  type ActionState,
} from '@/app/(admin)/actions';

export function ProductRowActions({
  id,
  name,
  journalName,
  active,
  isFirst,
  isLast,
}: {
  id: string;
  name: string;
  journalName: string | null;
  active: boolean;
  isFirst: boolean;
  isLast: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [state, action] = useFormState(renameProductAction, {} as ActionState);

  // On a successful save, close the editor and pull fresh data so the row shows
  // the new name immediately (revalidatePath alone didn't always repaint it).
  useEffect(() => {
    if (state.ok) {
      setEditing(false);
      router.refresh();
    }
  }, [state, router]);

  if (editing) {
    return (
      <form action={action} className="flex flex-wrap items-center justify-end gap-2">
        <input type="hidden" name="id" value={id} />
        <input name="name" defaultValue={name} placeholder="Full name" className="input h-8 w-44 text-xs" autoFocus />
        <input name="journalName" defaultValue={journalName ?? ''} placeholder="Journal name" maxLength={40} className="input h-8 w-28 text-xs" />
        <button type="submit" className="btn-primary text-xs">Save</button>
        <button type="button" className="btn-secondary text-xs" onClick={() => setEditing(false)}>Cancel</button>
        {state.error && <span className="text-xs text-red-600">{state.error}</span>}
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <div className="flex items-center">
        <form action={moveProductAction.bind(null, id, 'up')}>
          <button type="submit" disabled={isFirst} className="btn-secondary h-8 w-8 px-0 text-xs disabled:opacity-30" aria-label={`Move ${name} up`} title="Move up">↑</button>
        </form>
        <form action={moveProductAction.bind(null, id, 'down')} className="ml-1">
          <button type="submit" disabled={isLast} className="btn-secondary h-8 w-8 px-0 text-xs disabled:opacity-30" aria-label={`Move ${name} down`} title="Move down">↓</button>
        </form>
      </div>
      <button type="button" className="btn-secondary text-xs" onClick={() => setEditing(true)}>Rename</button>
      <form action={toggleProductActiveAction.bind(null, id)}>
        <button type="submit" className="btn-secondary text-xs">{active ? 'Archive' : 'Unarchive'}</button>
      </form>
      <form
        action={deleteProductAction.bind(null, id)}
        onSubmit={(e) => {
          if (!window.confirm(`Delete “${name}”? It will disappear from the picker (existing deals keep it).`)) {
            e.preventDefault();
          }
        }}
      >
        <button type="submit" className="btn-danger text-xs">Delete</button>
      </form>
    </div>
  );
}
