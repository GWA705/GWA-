'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface NavItem {
  href?: string;
  label: string;
  badge?: boolean;
  /** When present this item is a dropdown group instead of a link. */
  children?: NavItem[];
}

/**
 * The desktop link tray in the top bar. Highlights the current page as a solid
 * white pill (longest-prefix match). Items with `children` render as a hover /
 * focus dropdown so the bar stays on one line as menus grow.
 */
export function TopNav({ nav }: { nav: NavItem[] }) {
  const pathname = usePathname() || '';

  // Longest-prefix active match across every leaf link (top-level + children).
  const hrefs: string[] = [];
  for (const it of nav) {
    if (it.href) hrefs.push(it.href);
    it.children?.forEach((c) => c.href && hrefs.push(c.href));
  }
  let activeHref = '';
  for (const h of hrefs) {
    if ((pathname === h || pathname.startsWith(`${h}/`)) && h.length > activeHref.length) activeHref = h;
  }

  return (
    <nav className="topnav">
      {nav.map((item) => {
        if (item.children?.length) {
          const groupActive = item.children.some((c) => c.href === activeHref);
          const groupBadge = item.children.some((c) => c.badge);
          return (
            <div key={item.label} className="topnav-group" data-active={groupActive || undefined}>
              <button type="button" className="topnav-trigger" aria-haspopup="menu">
                {item.label}
                {groupBadge && <span className="nav-dot" aria-label="New" />}
                <svg className="chev" width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <div className="topnav-menu" role="menu">
                {item.children.map((c) => (
                  <Link
                    key={c.href}
                    href={c.href!}
                    role="menuitem"
                    aria-current={c.href === activeHref ? 'page' : undefined}
                  >
                    {c.label}
                    {c.badge && <span className="nav-dot ml-auto" title="New" aria-label="New" />}
                  </Link>
                ))}
              </div>
            </div>
          );
        }
        return (
          <Link
            key={item.href}
            href={item.href!}
            aria-current={item.href === activeHref ? 'page' : undefined}
            className={item.badge ? 'has-dot' : undefined}
          >
            {item.label}
            {item.badge && <span className="nav-dot" title="New" aria-label="New" />}
          </Link>
        );
      })}
    </nav>
  );
}
