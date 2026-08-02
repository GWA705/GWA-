'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
}

/**
 * The desktop link tray in the top bar. Highlights the current page as a solid
 * white pill — the active item is the nav entry whose href is the longest prefix
 * of the current path (so /admin/dealers highlights "Dealers", not "Overview").
 */
export function TopNav({ nav }: { nav: NavItem[] }) {
  const pathname = usePathname() || '';
  let activeHref = '';
  for (const item of nav) {
    const matches = pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (matches && item.href.length > activeHref.length) activeHref = item.href;
  }
  return (
    <nav className="topnav">
      {nav.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.href === activeHref ? 'page' : undefined}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
