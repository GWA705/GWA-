'use client';

import { useEffect, useState } from 'react';

/**
 * Wraps the reviewer entry view so it can be minimized once the reviewer has
 * finished re-keying the application into the lender. Collapsed, only a compact
 * snapshot shows, which tidies the page. The open/closed choice is remembered
 * per deal (localStorage), so a finished deal stays minimized when reopened.
 */
export function CollapsibleEntry({
  storageKey,
  snapshot,
  children,
}: {
  storageKey: string;
  snapshot: React.ReactNode;
  children: React.ReactNode;
}) {
  // null = not yet read from storage (default to open on first paint).
  const [open, setOpen] = useState<boolean | null>(null);

  useEffect(() => {
    const v = localStorage.getItem(storageKey);
    setOpen(v == null ? true : v === '1');
  }, [storageKey]);

  const isOpen = open ?? true;
  function toggle() {
    const next = !isOpen;
    setOpen(next);
    try {
      localStorage.setItem(storageKey, next ? '1' : '0');
    } catch {
      /* ignore */
    }
  }

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <button type="button" onClick={toggle} className="btn-secondary text-xs">
          {isOpen ? 'Minimize application ▲' : 'Show full application ▼'}
        </button>
      </div>
      {isOpen ? children : snapshot}
    </div>
  );
}
