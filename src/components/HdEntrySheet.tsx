'use client';

import { useState } from 'react';

export interface HdField {
  label: string;
  value: string | null;
  /** When set, shown as a greyed hint instead of a value (e.g. "reveal street first"). */
  missingHint?: string;
}
export interface HdSection {
  title: string;
  fields: HdField[];
}

/**
 * "Copy to Home Depot" sheet. Lays out exactly the fields the Home Depot
 * Service-Provider form asks for, in its order, each with a one-click Copy —
 * so staff stop hunting through the deal and re-typing. Values are pre-cased to
 * match HD (UPPERCASE for text, email left as-is) upstream.
 */
export function HdEntrySheet({ sections }: { sections: HdSection[] }) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1400);
    } catch {
      // Clipboard blocked (rare) — select fallback: prompt the user to copy.
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1400);
      } catch { /* give up silently; the value is visible to copy by hand */ }
    }
  }

  const allText = sections
    .flatMap((s) => s.fields.filter((f) => f.value).map((f) => `${f.label}: ${f.value}`))
    .join('\n');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">Click a field to copy it, then paste into the matching Home Depot box.</p>
        <button
          type="button"
          onClick={() => copy(allText, '__all__')}
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
        >
          {copiedKey === '__all__' ? 'Copied all ✓' : 'Copy all'}
        </button>
      </div>

      {sections.map((section) => (
        <div key={section.title}>
          <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-brand-700">{section.title}</h3>
          <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
            {section.fields.map((f) => {
              const key = `${section.title}:${f.label}`;
              const copied = copiedKey === key;
              const hasValue = !!f.value;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={!hasValue}
                  onClick={() => hasValue && copy(f.value as string, key)}
                  className={`flex w-full items-center gap-3 px-3 py-2 text-left transition ${hasValue ? 'hover:bg-brand-50/60' : 'cursor-default'}`}
                >
                  <span className="w-40 flex-none text-xs uppercase tracking-wide text-gray-400">{f.label}</span>
                  <span className={`min-w-0 flex-1 break-words font-mono text-sm ${hasValue ? 'text-gray-900' : 'text-gray-300'}`}>
                    {hasValue ? f.value : (f.missingHint || '—')}
                  </span>
                  {hasValue && (
                    <span className={`flex-none rounded px-2 py-0.5 text-[11px] font-semibold ${copied ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {copied ? 'Copied ✓' : 'Copy'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
