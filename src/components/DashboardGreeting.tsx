'use client';

import { useEffect, useState } from 'react';

/**
 * A time-aware greeting: "Good morning/afternoon/evening, <first name>".
 * Computed client-side so it follows the viewer's own clock. `className` styles
 * the heading (e.g. white text in the hero).
 */
export function DashboardGreeting({ firstName, className }: { firstName: string; className?: string }) {
  const [greeting, setGreeting] = useState<string | null>(null);

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening');
  }, []);

  // Reserve the space until the clock is read, so nothing jumps.
  if (!greeting) return <div className="h-10" aria-hidden />;

  return (
    <h1 className={`wm-greet-in ${className ?? 'text-2xl font-bold text-gray-900'}`}>
      {greeting}, {firstName}
    </h1>
  );
}
