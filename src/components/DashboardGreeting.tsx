'use client';

import { useEffect, useState } from 'react';

/**
 * A time-aware welcome on the dealer dashboard: "Good morning/afternoon/evening,
 * <first name>". Computed client-side so it follows the viewer's own clock.
 */
export function DashboardGreeting({ firstName }: { firstName: string }) {
  const [greeting, setGreeting] = useState<string | null>(null);

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening');
  }, []);

  // Reserve the space until the clock is read, so nothing jumps.
  if (!greeting) return <div className="mb-4 h-8" aria-hidden />;

  return (
    <div className="wm-greet-in mb-4">
      <h1 className="text-2xl font-bold text-gray-900">
        {greeting}, {firstName}
      </h1>
    </div>
  );
}
