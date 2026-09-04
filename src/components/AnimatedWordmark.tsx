'use client';

import { useEffect, useState } from 'react';

const SESSION_KEY = 'gwa:wordmarkIntro';
const WORDMARK = 'text-lg font-semibold text-brand-700';

/**
 * The header wordmark. For a dealer whose office profile has a company name, it
 * opens as "GWA Dealer Portal" and, once per browser session, softly blurs into
 * "<Company> Portal" after ~5s. Everywhere else (no company, reduced-motion, or
 * after the intro has played this session) it just shows the settled name.
 */
export function AnimatedWordmark({ companyName }: { companyName?: string | null }) {
  const co = (companyName ?? '').trim().slice(0, 48);
  const companyLabel = co ? `${co} Portal` : '';
  // 'pending' renders "GWA Dealer Portal" on the server + first client paint so
  // hydration matches; the effect then decides whether to morph or settle.
  const [phase, setPhase] = useState<'pending' | 'intro' | 'settled'>('pending');

  useEffect(() => {
    if (!co) return;
    let played = false;
    try {
      played = sessionStorage.getItem(SESSION_KEY) === '1';
    } catch {
      /* private mode — treat as not played */
    }
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (played || reduce) {
      setPhase('settled');
      return;
    }
    setPhase('intro');
    try {
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch {
      /* ignore */
    }
    const t = setTimeout(() => setPhase('settled'), 7000);
    return () => clearTimeout(t);
  }, [co]);

  if (!co || phase === 'pending') {
    return <span className={WORDMARK}>GWA Dealer Portal</span>;
  }
  if (phase === 'settled') {
    return <span className={WORDMARK}>{companyLabel}</span>;
  }
  // intro — crossfade + blur from GWA to the office name
  return (
    <span className={`relative inline-block whitespace-nowrap ${WORDMARK}`} aria-label={companyLabel}>
      <span className="wm-gwa absolute left-0 top-0">GWA Dealer Portal</span>
      <span className="wm-co">{companyLabel}</span>
    </span>
  );
}
