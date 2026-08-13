'use client';

import Link from 'next/link';
import { toggleResourceProductActiveAction, deleteResourceProductAction } from './actions';

export function ProductRowActions({ id, title, active }: { id: string; title: string; active: boolean }) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <Link href={`/admin/resource-library/${id}`} className="btn-secondary text-xs">
        Edit
      </Link>
      <form action={toggleResourceProductActiveAction.bind(null, id)}>
        <button type="submit" className="btn-secondary text-xs">
          {active ? 'Hide' : 'Show'}
        </button>
      </form>
      <form
        action={deleteResourceProductAction.bind(null, id)}
        onSubmit={(e) => {
          if (!window.confirm(`Delete “${title}” and all its files? This cannot be undone.`)) e.preventDefault();
        }}
      >
        <button type="submit" className="btn-danger text-xs">
          Delete
        </button>
      </form>
    </div>
  );
}
