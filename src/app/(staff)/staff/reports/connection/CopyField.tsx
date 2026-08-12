'use client';

import { useState } from 'react';

export function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded bg-gray-100 px-2 py-1.5 text-xs text-gray-800" title={value}>
        {value}
      </code>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* clipboard may be blocked; the value is still selectable above */
          }
        }}
        className="btn-secondary shrink-0 text-xs"
      >
        {copied ? 'Copied ✓' : 'Copy'}
      </button>
    </div>
  );
}
