'use client';

import { useState } from 'react';

export function TrainingLinkCard({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Older webviews: select-and-prompt fallback.
      window.prompt('Copy this training link:', url);
    }
  }
  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-4">
      <p className="text-sm font-semibold text-gray-900">Your training link</p>
      <p className="mb-2 text-xs text-gray-500">Send this to a new lead generator. Anyone who opens it is tied to your office automatically.</p>
      <div className="flex flex-wrap items-center gap-2">
        <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-xs text-gray-700" />
        <button onClick={copy} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">{copied ? 'Copied!' : 'Copy link'}</button>
      </div>
    </div>
  );
}
