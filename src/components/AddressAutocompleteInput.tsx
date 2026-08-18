'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Street-address input with address autocomplete, powered by our own server
 * routes (/api/places/*) so the Google key never reaches the browser (assessment
 * item R1). Predictions appear in a dropdown; picking one fills the sibling
 * City / Province / Postal fields (looked up by element id), or — in `fillFull`
 * mode — drops the full formatted address into this one field. If the server
 * has no key configured, no predictions ever load and this is an ordinary text
 * input, so the field always works.
 */

interface Prediction {
  description: string;
  placeId: string;
}

export function AddressAutocompleteInput({
  id,
  name,
  className,
  placeholder,
  defaultValue,
  cityId,
  provinceId,
  postalId,
  fillFull = false,
}: {
  id: string;
  name: string;
  className?: string;
  placeholder?: string;
  defaultValue?: string;
  cityId?: string;
  provinceId?: string;
  postalId?: string;
  fillFull?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [preds, setPreds] = useState<Prediction[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // A session token groups the keystrokes + the final details call for billing;
  // regenerated after each selection. Random per edit; fine to be non-crypto.
  const tokenRef = useRef<string>(Math.random().toString(36).slice(2));
  const seq = useRef(0);

  const setVal = (elId: string | undefined, val: string | undefined) => {
    if (!elId || !val) return;
    const el = document.getElementById(elId) as HTMLInputElement | HTMLSelectElement | null;
    if (el) el.value = val;
  };

  // Debounced fetch of predictions as the user types.
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const onInput = () => {
      const q = input.value.trim();
      if (q.length < 3) {
        setPreds([]);
        setOpen(false);
        return;
      }
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        const mine = ++seq.current;
        try {
          const res = await fetch(
            `/api/places/autocomplete?q=${encodeURIComponent(q)}&token=${tokenRef.current}`,
            { headers: { accept: 'application/json' } },
          );
          if (!res.ok) return;
          const data = (await res.json()) as { predictions?: Prediction[] };
          if (mine !== seq.current) return; // out-of-order
          const list = data.predictions ?? [];
          setPreds(list);
          setActive(-1);
          setOpen(list.length > 0);
        } catch {
          /* offline / no key — stay a plain input */
        }
      }, 250);
    };

    input.addEventListener('input', onInput);
    return () => {
      input.removeEventListener('input', onInput);
      if (timer) clearTimeout(timer);
    };
  }, []);

  // Close the dropdown on an outside click.
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  async function choose(p: Prediction) {
    const input = inputRef.current;
    if (!input) return;
    setOpen(false);
    try {
      const res = await fetch(
        `/api/places/details?placeId=${encodeURIComponent(p.placeId)}&token=${tokenRef.current}`,
        { headers: { accept: 'application/json' } },
      );
      const data = (await res.json()) as {
        details?: { street: string; city: string; province: string; postal: string; formatted: string } | null;
      };
      const d = data.details;
      // New session token for the next address the user edits.
      tokenRef.current = Math.random().toString(36).slice(2);
      if (!d) {
        input.value = p.description.replace(/,\s*Canada$/i, '');
        return;
      }
      if (fillFull) {
        input.value = d.formatted || d.street || p.description;
      } else {
        input.value = d.street || p.description;
        setVal(cityId, d.city);
        setVal(provinceId, d.province);
        setVal(postalId, d.postal);
      }
      // Let any listeners (e.g. controlled forms) notice the change.
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } catch {
      input.value = p.description.replace(/,\s*Canada$/i, '');
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || preds.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, preds.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      choose(preds[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <input
        ref={inputRef}
        id={id}
        name={name}
        defaultValue={defaultValue}
        className={className}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        onKeyDown={onKeyDown}
        onFocus={() => preds.length > 0 && setOpen(true)}
      />
      {open && preds.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-lg">
          {preds.map((p, i) => (
            <li key={p.placeId}>
              <button
                type="button"
                // onMouseDown (not click) so it fires before the input blur closes the list.
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(p);
                }}
                className={`block w-full truncate px-3 py-2 text-left text-gray-700 hover:bg-gray-50 ${i === active ? 'bg-gray-50' : ''}`}
              >
                {p.description.replace(/,\s*Canada$/i, '')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
