'use client';

import { useState, type ReactNode } from 'react';

/**
 * A card section whose body can fold to a one-line summary. Used on the deal page
 * so a finished step (e.g. "Documents for approval" once the deal is approved and
 * the docs are in) collapses out of the way instead of showing a full uploader,
 * while staying one tap away.
 */
export function CollapsibleSection({
  title,
  defaultOpen = true,
  summary,
  children,
  className,
}: {
  title: string;
  defaultOpen?: boolean;
  summary?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`card p-6 ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <h2 className="border-l-4 border-brand-500 pl-2.5 text-lg font-bold text-gray-900">{title}</h2>
        <span className="flex flex-none items-center gap-2 text-sm text-gray-500">
          {!open && summary}
          <svg
            className={`h-5 w-5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden
          >
            <path d="M5.5 7.5 10 12l4.5-4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {open && <div className="mt-4">{children}</div>}
    </section>
  );
}
