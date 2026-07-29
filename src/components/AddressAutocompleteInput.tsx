'use client';

import { useEffect, useRef } from 'react';

/**
 * Street-address input with Google Places autocomplete. Activates only when
 * NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is configured; otherwise it is an ordinary
 * text input, so nothing external loads and the field still works. When a
 * suggestion is picked it fills the sibling City / Province / Postal fields
 * (looked up by element id) and the user can still type over anything.
 */
export function AddressAutocompleteInput({
  id,
  name,
  className,
  placeholder,
  cityId,
  provinceId,
  postalId,
}: {
  id: string;
  name: string;
  className?: string;
  placeholder?: string;
  cityId?: string;
  provinceId?: string;
  postalId?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    const input = ref.current;
    if (!key || !input) return;
    let cancelled = false;

    const setVal = (elId: string | undefined, val: string | undefined) => {
      if (!elId || !val) return;
      const el = document.getElementById(elId) as HTMLInputElement | HTMLSelectElement | null;
      if (el) el.value = val;
    };

    const attach = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = (window as any).google;
      if (cancelled || !g?.maps?.places) return;
      const ac = new g.maps.places.Autocomplete(input, {
        componentRestrictions: { country: 'ca' },
        fields: ['address_components'],
        types: ['address'],
      });
      ac.addListener('place_changed', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const comps: any[] = ac.getPlace()?.address_components || [];
        const get = (t: string) => comps.find((c) => c.types.includes(t));
        const street = `${get('street_number')?.long_name || ''} ${get('route')?.long_name || ''}`.trim();
        if (street) input.value = street;
        setVal(cityId, get('locality')?.long_name || get('postal_town')?.long_name || get('sublocality')?.long_name);
        setVal(provinceId, get('administrative_area_level_1')?.short_name);
        setVal(postalId, get('postal_code')?.long_name);
      });
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).google?.maps?.places) {
      attach();
      return () => {
        cancelled = true;
      };
    }

    const onReady = () => {
      let tries = 0;
      const t = setInterval(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((window as any).google?.maps?.places || tries++ > 40) {
          clearInterval(t);
          attach();
        }
      }, 100);
    };

    const SCRIPT_ID = 'gmaps-places-script';
    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.async = true;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&loading=async`;
      document.head.appendChild(script);
    }
    script.addEventListener('load', onReady);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).google?.maps) onReady();

    return () => {
      cancelled = true;
      script?.removeEventListener('load', onReady);
    };
  }, [id, cityId, provinceId, postalId]);

  return <input ref={ref} id={id} name={name} className={className} placeholder={placeholder} autoComplete="off" />;
}
