'use client';

import { useState, useTransition } from 'react';
import { runTranslateHealthCheck, type TranslateHealthResult } from './actions';

/**
 * Admin diagnostic: one-click live test of the translation provider chain
 * (DeepL → Google → MyMemory). Shows which provider answered and the result.
 */
export function TranslateHealthCheck() {
  const [res, setRes] = useState<TranslateHealthResult | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="mt-4 border-t border-gray-100 pt-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-gray-700">Live translation test</span>
        <button
          type="button"
          onClick={() => start(async () => setRes(await runTranslateHealthCheck()))}
          disabled={pending}
          className="btn-secondary text-xs disabled:opacity-60"
        >
          {pending ? 'Testing…' : 'Run test'}
        </button>
      </div>

      {res && (
        <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs">
          <div className="flex items-center gap-2">
            <span
              className={`badge ${res.ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}`}
            >
              {res.ok ? 'Working' : 'Failed'}
            </span>
            <span className="text-gray-600">
              via <strong>{res.providerName}</strong>
              {res.error ? ` · ${res.error}` : ''}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-400">Sent (FR)</div>
              <div className="text-gray-700">{res.input}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-400">Got back (EN)</div>
              <div className="text-gray-900">{res.output}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
