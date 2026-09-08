'use client';

import { useRef, useState } from 'react';
import { ScanLine, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { BorrowerAutofill } from '@/lib/autofill';

/**
 * Driver's-licence scan → autofill. Take or upload a clear photo of the FRONT of
 * the licence; the image is sent to /api/scan-id (AWS Textract AnalyzeID), which
 * reads the name, address, date of birth and licence number and returns them for
 * the dealer to review. The image is processed in memory and NEVER stored.
 *
 * The old on-device PDF417 barcode scanner (live camera + still decode) was
 * removed — barcode reads weren't reliable enough. This is a photo/OCR flow only.
 */

type Status = 'idle' | 'reading' | 'ok' | 'fail';

export function LicenseScan({ onFields, className = '', label }: { onFields: (f: BorrowerAutofill) => void; className?: string; label?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [msg, setMsg] = useState('');

  async function handleFile(file: File) {
    setStatus('reading');
    setMsg('');
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch('/api/scan-id', { method: 'POST', body: fd });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok && data.fields) {
        const f = data.fields as BorrowerAutofill;
        onFields(f);
        setStatus('ok');
        const name = `${f.firstName ?? ''} ${f.lastName ?? ''}`.replace(/\s+/g, ' ').trim();
        setMsg(`Filled from the licence photo${name ? ` for ${name}` : ''}. Please review each field.`);
        return;
      }
      setStatus('fail');
      setMsg(
        data?.reason === 'not_enabled'
          ? "Licence photo scanning isn’t switched on yet — enter the details manually for now."
          : data?.reason === 'rate_limited'
            ? 'Too many scans just now. Wait a moment and try again.'
            : "Couldn’t read the licence. Take a clearer, well-lit photo of the FRONT of the card, or enter the details manually.",
      );
    } catch {
      setStatus('fail');
      setMsg("Couldn’t reach the scanner. Check your connection, or enter the details manually.");
    }
  }

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={status === 'reading'}
        className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:opacity-60"
      >
        {status === 'reading' ? <Loader2 size={16} className="animate-spin" /> : <ScanLine size={16} />}
        {status === 'reading' ? 'Reading licence…' : (label || 'Scan driver’s licence')}
      </button>

      <p className="mt-1 text-xs text-gray-500">
        Take or upload a clear photo of the <strong>front</strong> of the licence — the details fill in automatically. Nothing is stored.
      </p>
      {status === 'ok' && (
        <p className="mt-1 flex items-center gap-1 text-xs font-medium text-emerald-700">
          <CheckCircle2 size={13} /> {msg}
        </p>
      )}
      {status === 'fail' && (
        <p className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-700">
          <AlertTriangle size={13} /> {msg}
        </p>
      )}
    </div>
  );
}
