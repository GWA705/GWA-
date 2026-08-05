'use client';

import { useRef, useState } from 'react';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function parse(value: string): { y: string; m: string; d: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  return m ? { y: m[1], m: m[2], d: m[3] } : { y: '', m: '', d: '' };
}

// A real calendar date? Guards against 2026-02-31 etc.
function isRealDate(y: string, m: string, d: string): boolean {
  const yi = Number(y), mi = Number(m), di = Number(d);
  if (y.length !== 4 || !mi || !di) return false;
  const dt = new Date(yi, mi - 1, di);
  return dt.getFullYear() === yi && dt.getMonth() === mi - 1 && dt.getDate() === di;
}

/**
 * Date-of-birth input tuned for speed on mobile: a Month dropdown, a Day box, and
 * a Year box you type directly (four digits) — no scrolling back through decades
 * like the native date wheel. The three fields compose into a hidden
 * `YYYY-MM-DD` value under `name`, so the form and server validation are
 * unchanged. Used only for DOB; other dates keep the native picker.
 */
export function DateOfBirthInput({
  name,
  id,
  defaultValue = '',
  invalid = false,
}: {
  name: string;
  id?: string;
  defaultValue?: string;
  invalid?: boolean;
}) {
  const init = parse(defaultValue);
  const [y, setY] = useState(init.y);
  const [m, setM] = useState(init.m);
  const [d, setD] = useState(init.d);
  const yearRef = useRef<HTMLInputElement>(null);

  // Only emit a value once it's a complete, real date; otherwise stay empty so an
  // optional DOB remains optional and a half-typed date never submits.
  const composed = isRealDate(y, m, d) ? `${y}-${m}-${d.padStart(2, '0')}` : '';

  const base = `input ${invalid ? 'ring-red-400' : ''}`;

  return (
    <div>
      <input type="hidden" name={name} value={composed} />
      <div className="flex gap-2">
        <select
          id={id}
          aria-label="Birth month"
          className={`${base} flex-[1.4]`}
          value={m}
          onChange={(e) => setM(e.target.value)}
        >
          <option value="">Month</option>
          {MONTHS.map((label, i) => (
            <option key={label} value={String(i + 1).padStart(2, '0')}>{label}</option>
          ))}
        </select>
        <input
          aria-label="Birth day"
          inputMode="numeric"
          placeholder="Day"
          maxLength={2}
          className={`${base} flex-1`}
          value={d}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '').slice(0, 2);
            setD(v);
            if (v.length === 2) yearRef.current?.focus();
          }}
        />
        <input
          ref={yearRef}
          aria-label="Birth year"
          inputMode="numeric"
          placeholder="Year"
          maxLength={4}
          className={`${base} flex-1`}
          value={y}
          onChange={(e) => setY(e.target.value.replace(/\D/g, '').slice(0, 4))}
        />
      </div>
    </div>
  );
}
