'use client';

import { useState } from 'react';

/**
 * A compact "Copy" button for one setup-sheet line, so Sam can lift each value
 * straight into the matching Entuitive field instead of retyping it. Copies on
 * click, with a brief ✓; if the clipboard is blocked, the value is still shown
 * in the row and can be selected by hand.
 */
export function CopyLine({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={label ? `Copy ${label}` : 'Copy'}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        } catch {
          /* clipboard blocked — value is still selectable in the row */
        }
      }}
      className={`shrink-0 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors ${
        copied
          ? 'border-green-200 bg-green-50 text-green-700'
          : 'border-slate-200 bg-white text-slate-500 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700'
      }`}
    >
      {copied ? 'Copied ✓' : 'Copy'}
    </button>
  );
}
