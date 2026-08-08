import type { ReactNode } from 'react';

/**
 * A small "ⓘ" button next to a section heading. Clicking it reveals a short
 * explanation in a popover, so the help text is there when someone wants it but
 * doesn't clutter the page by default. Built on the native <details> element —
 * no client JavaScript, works everywhere, and closes when clicked again.
 */
export function InfoPopover({ children, label = 'More information' }: { children: ReactNode; label?: string }) {
  return (
    <details className="group relative inline-block align-middle">
      <summary
        aria-label={label}
        title={label}
        className="flex h-5 w-5 cursor-pointer list-none items-center justify-center rounded-full bg-gray-100 text-[11px] font-bold text-gray-500 transition hover:bg-brand-100 hover:text-brand-700 group-open:bg-brand-100 group-open:text-brand-700 [&::-webkit-details-marker]:hidden"
      >
        i
      </summary>
      <div
        role="tooltip"
        className="absolute left-0 top-7 z-30 w-64 max-w-[80vw] rounded-lg border border-gray-200 bg-white p-3 text-xs font-normal leading-relaxed text-gray-600 shadow-lg"
      >
        {children}
      </div>
    </details>
  );
}
