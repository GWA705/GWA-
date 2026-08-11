'use client';

import { useState } from 'react';
import { SupportContactForm, type ContactValues } from './SupportContactForm';
import {
  updateSupportContactAction,
  toggleSupportContactAction,
  deleteSupportContactAction,
} from '@/app/(admin)/actions';

export function SupportContactRow({ contact }: { contact: ContactValues & { active: boolean; logoStorageKey?: string | null } }) {
  const [editing, setEditing] = useState(false);
  const logoUrl = contact.logoStorageKey ? `/api/support-contacts/${contact.id}/logo` : null;

  if (editing) {
    return (
      <li className="card p-5">
        <SupportContactForm
          action={updateSupportContactAction}
          values={contact}
          logoUrl={logoUrl}
          submitLabel="Save changes"
          onDone={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-11 w-11 flex-none rounded-lg border border-gray-200 object-contain" />
          )}
          <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-gray-900">{contact.name}</h3>
            {!contact.active && <span className="badge bg-gray-100 text-gray-600">Hidden</span>}
          </div>
          {contact.title && <p className="text-xs uppercase tracking-wide text-gray-400">{contact.title}</p>}
          <p className="mt-2 text-sm text-gray-600">
            {[contact.phone, contact.altPhone, contact.email].filter(Boolean).join(' · ') || '—'}
          </p>
          {contact.hours && <p className="text-sm text-gray-500">{contact.hours}</p>}
          </div>
        </div>
        <div className="flex flex-none flex-wrap justify-end gap-2">
          <button type="button" className="btn-secondary text-xs" onClick={() => setEditing(true)}>Edit</button>
          <form action={toggleSupportContactAction.bind(null, contact.id!)}>
            <button type="submit" className="btn-secondary text-xs">{contact.active ? 'Hide' : 'Show'}</button>
          </form>
          <form
            action={deleteSupportContactAction.bind(null, contact.id!)}
            onSubmit={(e) => { if (!window.confirm(`Delete “${contact.name}”?`)) e.preventDefault(); }}
          >
            <button type="submit" className="btn-danger text-xs">Delete</button>
          </form>
        </div>
      </div>
    </li>
  );
}
