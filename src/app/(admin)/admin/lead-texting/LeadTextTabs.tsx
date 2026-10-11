'use client';

import { useEffect, useState } from 'react';

export interface LeadTextTab {
  key: string;
  label: string;
  content: React.ReactNode;
}

/**
 * Tabbed shell for the Lead auto-text page. All panels stay mounted (toggled with
 * `hidden`) so form edits and the message-editor draft survive tab switches.
 */
export function LeadTextTabs({ tabs }: { tabs: LeadTextTab[] }) {
  const [active, setActive] = useState(tabs[0]?.key);

  // Remember the last tab for this admin (per-browser convenience).
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('leadTextTab');
      if (saved && tabs.some((t) => t.key === saved)) setActive(saved);
    } catch { /* storage blocked — use default */ }
  }, [tabs]);
  useEffect(() => {
    try { if (active) window.localStorage.setItem('leadTextTab', active); } catch { /* ignore */ }
  }, [active]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-1 rounded-full bg-white p-1 ring-1 ring-inset ring-gray-200 dark:bg-slate-800 dark:ring-slate-700" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active === t.key}
            onClick={() => setActive(t.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${active === t.key ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-50 dark:text-slate-300 dark:hover:bg-slate-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.key} role="tabpanel" hidden={active !== t.key}>
          {t.content}
        </div>
      ))}
    </div>
  );
}
