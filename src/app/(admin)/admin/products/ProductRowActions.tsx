'use client';

import { useState } from 'react';
import { useFormState } from 'react-dom';
import {
  renameProductAction,
  toggleProductActiveAction,
  deleteProductAction,
  type ActionState,
} from '@/app/(admin)/actions';

export function ProductRowActions({
  id,
  name,
  active,
}: {
  id: string;
  name: string;
  active: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useFormState(renameProductAction, {} as ActionState);

  if (editing && !state.ok) {
    return (
      <form action={action} className="flex items-center justify-end gap-2">
        <input type="hidden" name="id" value={id} />
        <input name="name" defaultValue={name} className="input h-8 w-40 text-xs" autoFocus />
        <button type="submit" className="btn-primary text-xs">Save</button>
        <button type="button" className="btn-secondary text-xs" onClick={() => setEditing(false)}>Cancel</button>
        {state.error && <span className="text-xs text-red-600">{state.error}</span>}
      </form>
    );
  }

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <button type="button" className="btn-secondary text-xs" onClick={() => setEditing(true)}>Rename</button>
      <form action={toggleProductActiveAction.bind(null, id)}>
        <button type="submit" className="btn-secondary text-xs">{active ? 'Archive' : 'Unarchive'}</button>
      </form>
      <form
        action={deleteProductAction.bind(null, id)}
        onSubmit={(e) => {
          if (!window.confirm(`Delete “${name}”? It will disappear from the dropdown (existing deals keep it).`)) {
            e.preventDefault();
          }
        }}
      >
        <button type="submit" className="btn-danger text-xs">Delete</button>
      </form>
    </div>
  );
}
