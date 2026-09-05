'use client';

import { useEffect, useState } from 'react';
import { Sun, Sunrise, MoonStar, type LucideIcon } from 'lucide-react';
import { useT } from '@/i18n/client';

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
  const t = useT();
  const [part, setPart] = useState<'morning' | 'afternoon' | 'evening' | null>(null);

  useEffect(() => {
    const h = new Date().getHours();
    setPart(h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening');
  }, []);

  const BY_PART: Record<'morning' | 'afternoon' | 'evening', { key: string; Icon: LucideIcon; tone: string }> = {
    morning: { key: 'dashboard.goodMorning', Icon: Sunrise, tone: 'text-amber-300' },
    afternoon: { key: 'dashboard.goodAfternoon', Icon: Sun, tone: 'text-yellow-300' },
    evening: { key: 'dashboard.goodEvening', Icon: MoonStar, tone: 'text-sky-200' },
  };
  const state = part ? { text: t(BY_PART[part].key), Icon: BY_PART[part].Icon, tone: BY_PART[part].tone } : null;

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
