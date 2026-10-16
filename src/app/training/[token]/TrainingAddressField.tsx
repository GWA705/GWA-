'use client';

import { useEffect, useRef, useState } from 'react';

interface Prediction { description: string; placeId: string }
interface Details { street: string; city: string; province: string; postal: string; formatted: string }

/**
 * Controlled street-address input with Google-powered autocomplete for the public
 * training intake. Talks to the token-gated /api/training/<token>/places route so
 * the Google key never reaches the browser. Picking a suggestion fills the street
 * (this field) and reports city + postal back to the parent. If no key is
 * configured or the user is offline, it quietly behaves as a plain text input.
 */
export function TrainingAddressField({
  token, value, onChange, onPick, className, placeholder,
}: {
  token: string;
  value: string;
  onChange: (street: string) => void;
  onPick: (parts: { street: string; city: string; postal: string }) => void;
  className?: string;
  placeholder?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [preds, setPreds] = useState<Prediction[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const sessionTok = useRef(Math.random().toString(36).slice(2));
  const seq = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function queryPredictions(q: string) {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 3) { setPreds([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      const mine = ++seq.current;
      try {
        const res = await fetch(`/api/training/${token}/places?q=${encodeURIComponent(q)}&token=${sessionTok.current}`, { headers: { accept: 'application/json' } });
        if (!res.ok) return;
        const data = (await res.json()) as { predictions?: Prediction[] };
        if (mine !== seq.current) return;
        const list = data.predictions ?? [];
        setPreds(list); setActive(-1); setOpen(list.length > 0);
      } catch { /* offline / no key — stay a plain input */ }
    }, 250);
  }

  async function choose(p: Prediction) {
    setOpen(false);
    try {
      const res = await fetch(`/api/training/${token}/places?placeId=${encodeURIComponent(p.placeId)}&token=${sessionTok.current}`, { headers: { accept: 'application/json' } });
      const data = (await res.json()) as { details?: Details | null };
      sessionTok.current = Math.random().toString(36).slice(2);
      const d = data.details;
      if (!d) { onChange(p.description.replace(/,\s*Canada$/i, '')); return; }
      onChange(d.street || p.description);
      onPick({ street: d.street || p.description, city: d.city || '', postal: d.postal || '' });
    } catch {
      onChange(p.description.replace(/,\s*Canada$/i, ''));
    }
  }

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || preds.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, preds.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); choose(preds[active]); }
    else if (e.key === 'Escape') setOpen(false);
  }

  return (
    <div ref={boxRef} className="relative">
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); queryPredictions(e.target.value); }}
        onKeyDown={onKeyDown}
        onFocus={() => preds.length > 0 && setOpen(true)}
        className={className}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {open && preds.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg">
          {preds.map((p, i) => (
            <li key={p.placeId}>
              <button type="button" onMouseDown={(e) => { e.preventDefault(); choose(p); }}
                className={`block w-full truncate px-3 py-2 text-left text-slate-700 hover:bg-slate-50 ${i === active ? 'bg-slate-50' : ''}`}>
                {p.description.replace(/,\s*Canada$/i, '')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
