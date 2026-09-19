'use client';

import { useState } from 'react';
import { ScanLeadCard } from './ScanLeadCard';

/**
 * Compact "＋ Scan cards" button that reveals the HD Mail In Test scanner inline.
 * A small client island so it can sit inside the server-rendered merged Leads
 * toolbar without making the whole view a client component.
 */
export function ScanCardsPanel() {
  const [open, setOpen] = useState(false);
  return (
    <div className={open ? 'w-full' : ''}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="btn-primary whitespace-nowrap"
      >
        {open ? '× Close' : '＋ Scan cards'}
      </button>
      {open && (
        <div className="mt-3">
          <ScanLeadCard onSaved={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
