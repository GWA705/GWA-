'use client';

import { useEffect, useState, useTransition } from 'react';
import { getTwilioUsageAction } from '@/app/(admin)/actions';
import type { TwilioUsage } from '@/lib/twilioUsage';

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-CA', { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-gray-900">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-gray-400">{sub}</div>}
    </div>
  );
}

/**
 * Read-only Twilio cost meter — balance + SMS spend this month and today. Loads
 * on mount and on demand. Uses the account's own currency (whatever Twilio
 * returns), so no assumptions about USD vs CAD.
 */
export function TwilioUsageCard({ enabled }: { enabled: boolean }) {
  const [data, setData] = useState<TwilioUsage | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [at, setAt] = useState<string>('');
  const [pending, start] = useTransition();

  function load() {
    setErr(null);
    start(async () => {
      const r = await getTwilioUsageAction();
      if (r.error) { setErr(r.error); setData(null); return; }
      setData(r.usage ?? null);
      setAt(new Date().toLocaleTimeString('en-CA'));
    });
  }

  useEffect(() => {
    if (enabled) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  if (!enabled) {
    return <p className="text-xs text-amber-700">Connect texting first (badge above) to see spend.</p>;
  }

  const months = data?.thisMonth;
  const today = data?.today;
  const bal = data?.balance;
  const cur = months?.currency || bal?.currency || 'USD';

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Tile
          label="SMS this month"
          value={months ? money(months.price, months.currency) : '—'}
          sub={months ? `${months.count} text${months.count === 1 ? '' : 's'}` : undefined}
        />
        <Tile
          label="SMS today"
          value={today ? money(today.price, today.currency) : '—'}
          sub={today ? `${today.count} text${today.count === 1 ? '' : 's'}` : undefined}
        />
        <Tile
          label="Balance"
          value={bal ? money(bal.amount, bal.currency) : 'n/a'}
          sub={bal ? 'remaining funds' : 'not available on this account'}
        />
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={load}
          disabled={pending}
          className="btn-secondary text-xs disabled:opacity-50"
        >
          {pending ? 'Refreshing…' : 'Refresh'}
        </button>
        {at && !err && <span className="text-xs text-gray-400">as of {at}</span>}
      </div>

      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      <p className="mt-2 text-[11px] text-gray-400">
        Figures come straight from Twilio (this account&rsquo;s usage records). Spend is in {cur}.
      </p>
    </div>
  );
}
