import type { ReactNode } from 'react';

/**
 * A card that collapses to just its title until opened. Uses the native <details>
 * element, so it needs no client JS and works in a server component. Used to keep
 * the AI-assistant tools on the System health page tucked away until wanted, so
 * the page doesn't sprawl.
 */
export function CollapsibleCard({
  title,
  hint,
  defaultOpen = false,
  children,
}: {
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group rounded-2xl border border-gray-200 bg-white shadow-sm [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3.5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          {hint && <p className="mt-0.5 truncate text-xs text-gray-500">{hint}</p>}
        </div>
        <svg
          className="h-4 w-4 flex-none text-gray-400 transition-transform group-open:rotate-180"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M6 8l4 4 4-4" />
        </svg>
      </summary>
      <div className="border-t border-gray-100 p-5">{children}</div>
    </details>
  );
}
