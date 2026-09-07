'use client';

import { useRef, useState } from 'react';
import { ScanLine, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  PDF417Reader,
  RGBLuminanceSource,
  HybridBinarizer,
  BinaryBitmap,
  DecodeHintType,
} from '@zxing/library';
import { parseAamva, type LicenseFields } from '@/lib/aamva';
import { useT } from '@/i18n/client';

/**
 * Driver's-licence scan → autofill. PRIMARY path is fully on-device: the dealer
 * photographs the BACK of the licence, we decode its PDF417 barcode (exact AAMVA
 * data) in the browser and fill the form — the image never leaves the device.
 * FALLBACK: if no barcode reads (front photo, damaged card), the image is sent to
 * /api/scan-id (AWS Textract AnalyzeID), which extracts fields and discards the
 * image. Either way, the dealer reviews the filled fields before submitting.
 */

type Status = 'idle' | 'reading' | 'ok' | 'partial' | 'fail';

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = url;
  });
}

/** Decode a PDF417 barcode from an image file, entirely in the browser. */
async function decodeBarcode(file: File): Promise<string | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const maxW = 2000; // keep enough resolution for the dense PDF417 bars
    const scale = Math.min(1, maxW / img.width);
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    const size = w * h;
    const lum = new Uint8ClampedArray(size);
    for (let i = 0; i < size; i++) {
      const o = i * 4;
      lum[i] = (data[o] * 0.299 + data[o + 1] * 0.587 + data[o + 2] * 0.114) | 0;
    }
    const source = new RGBLuminanceSource(lum, w, h);
    const bitmap = new BinaryBitmap(new HybridBinarizer(source));
    const hints = new Map();
    hints.set(DecodeHintType.TRY_HARDER, true);
    try {
      const result = new PDF417Reader().decode(bitmap, hints);
      return result.getText();
    } catch {
      return null; // NotFound — no barcode in this image
    }
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function LicenseScan({ onFields, className = '' }: { onFields: (f: LicenseFields) => void; className?: string }) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [msg, setMsg] = useState('');

  async function handleFile(file: File) {
    setStatus('reading');
    setMsg('');

    // 1) On-device barcode (back of licence).
    const payload = await decodeBarcode(file);
    if (payload) {
      const fields = parseAamva(payload);
      if (fields) {
        onFields(fields);
        setStatus('ok');
        setMsg(`Filled from ${fields.firstName} ${fields.lastName}'s licence. Please review.`.replace(/\s+/g, ' '));
        return;
      }
    }

    // 2) Cloud fallback (AWS Textract) — used only when no barcode read.
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch('/api/scan-id', { method: 'POST', body: fd });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok && data.fields) {
        onFields(data.fields as LicenseFields);
        setStatus('ok');
        setMsg('Filled from the licence photo. Please review each field.');
        return;
      }
      if (data?.reason === 'not_enabled') {
        setStatus('fail');
        setMsg("Couldn't read the barcode. Take a clear photo of the BACK of the licence, or enter the details manually.");
        return;
      }
    } catch {
      /* fall through to the generic failure */
    }

    setStatus('fail');
    setMsg("Couldn't read the licence. Try a sharper, well-lit photo of the BACK (the barcode side), or enter the details manually.");
  }

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = ''; // allow re-picking the same file
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={status === 'reading'}
        className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:opacity-60"
      >
        {status === 'reading' ? <Loader2 size={16} className="animate-spin" /> : <ScanLine size={16} />}
        {status === 'reading' ? 'Reading licence…' : 'Scan driver’s licence'}
      </button>
      <p className="mt-1 text-xs text-gray-500">
        Photograph the <strong>back</strong> of the licence (the barcode) for the most accurate fill. The image isn’t stored.
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
