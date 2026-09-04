'use client';

import { useEffect, useState } from 'react';
import { Sun, Sunrise, MoonStar, type LucideIcon } from 'lucide-react';

/**
 * A time-aware greeting: "Good morning/afternoon/evening, <first name>".
 * Computed client-side so it follows the viewer's own clock. `className` styles
 * the heading (e.g. white text in the hero). With `withIcon`, a matching
 * sun/sunrise/moon icon leads the greeting.
 */
export function DashboardGreeting({
  firstName,
  className,
  withIcon = false,
}: {
  firstName: string;
  className?: string;
  withIcon?: boolean;
}) {
  const [state, setState] = useState<{ text: string; Icon: LucideIcon; tone: string } | null>(null);

  useEffect(() => {
    const h = new Date().getHours();
    if (h < 12) setState({ text: 'Good morning', Icon: Sunrise, tone: 'text-amber-300' });
    else if (h < 18) setState({ text: 'Good afternoon', Icon: Sun, tone: 'text-yellow-300' });
    else setState({ text: 'Good evening', Icon: MoonStar, tone: 'text-sky-200' });
  }, []);

  // Reserve the space until the clock is read, so nothing jumps.
  if (!state) return <div className="h-10" aria-hidden />;

  const { text, Icon, tone } = state;
  return (
    <h1 className={`wm-greet-in flex items-center gap-2.5 ${className ?? 'text-2xl font-bold text-gray-900'}`}>
      {withIcon && <Icon className={`flex-none ${tone}`} size={30} aria-hidden />}
      <span>
        {text}, {firstName}
      </span>
    </h1>
  );
}
