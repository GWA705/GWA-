import type { ReactNode } from 'react';

/**
 * One shared page title used across the portal for a consistent, finished look.
 *
 *  - default: a small brand "eyebrow" category above the title (the base style
 *    everywhere).
 *  - rail: adds a brand accent bar on the left and a hairline divider beneath —
 *    for data-heavy list pages.
 *  - hero: sets the header in a soft branded band — reserved for a couple of
 *    landing/hub pages.
 *
 * `right` renders an optional action (e.g. a primary button) beside the title.
 */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  variant = 'default',
  icon,
  right,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  variant?: 'default' | 'rail' | 'hero';
  icon?: string;
  right?: ReactNode;
}) {
  const inner = (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <div className="text-xs font-bold uppercase tracking-[0.09em] text-brand-600">{eyebrow}</div>
        )}
        <h1 className="text-xl font-bold tracking-tight text-gray-900 text-balance sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-gray-500">{subtitle}</p>}
      </div>
      {right && <div className="flex-none">{right}</div>}
    </div>
  );

  if (variant === 'hero') {
    return (
      <section className="relative overflow-hidden rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 via-white to-white p-6 shadow-sm dark:bg-none dark:bg-[var(--d-surface)] sm:p-7">
        <div className="flex items-start gap-4">
          {icon && (
            <div className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-brand-600 text-2xl text-white shadow-sm">
              {icon}
            </div>
          )}
          <div className="min-w-0 flex-1">{inner}</div>
        </div>
      </section>
    );
  }

  if (variant === 'rail') {
    return (
      <div>
        <div className="border-l-4 border-brand-600 pl-4">{inner}</div>
        <div className="mt-4 border-b border-gray-100" />
      </div>
    );
  }

  return <div>{inner}</div>;
}
