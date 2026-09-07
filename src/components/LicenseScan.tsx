'use client';

import { useRef, useState } from 'react';
import { ScanLine, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  PDF417Reader,
  RGBLuminanceSource,
  HybridBinarizer,
  GlobalHistogramBinarizer,
  BinaryBitmap,
  DecodeHintType,
} from '@zxing/library';
import { parseAamva } from '@/lib/aamva';
import type { BorrowerAutofill } from '@/lib/autofill';
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

function luminanceOf(canvas: HTMLCanvasElement): { lum: Uint8ClampedArray; w: number; h: number } | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const w = canvas.width;
  const h = canvas.height;
  const { data } = ctx.getImageData(0, 0, w, h);
  const size = w * h;
  const lum = new Uint8ClampedArray(size);
  for (let i = 0; i < size; i++) {
    const o = i * 4;
    lum[i] = (data[o] * 0.299 + data[o + 1] * 0.587 + data[o + 2] * 0.114) | 0;
  }
  return { lum, w, h };
}

/** Rotate a canvas by 0/90/180/270 degrees, returning a new canvas. */
function rotateCanvas(src: HTMLCanvasElement, deg: number): HTMLCanvasElement {
  if (deg === 0) return src;
  const swap = deg === 90 || deg === 270;
  const out = document.createElement('canvas');
  out.width = swap ? src.height : src.width;
  out.height = swap ? src.width : src.height;
  const ctx = out.getContext('2d');
  if (!ctx) return src;
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
  return out;
}

function tryDecode(source: RGBLuminanceSource): string | null {
  const hints = new Map();
  hints.set(DecodeHintType.TRY_HARDER, true);
  for (const makeBin of [
    () => new HybridBinarizer(source),
    () => new GlobalHistogramBinarizer(source),
  ]) {
    try {
      const result = new PDF417Reader().decode(new BinaryBitmap(makeBin()), hints);
      const text = result?.getText();
      if (text) return text;
    } catch {
      /* NotFound — try the next binarizer */
    }
  }
  return null;
}

/**
 * Decode a PDF417 barcode from a still photo, entirely in the browser. A phone
 * photo of a licence back is dense and often rotated, so we try 4 orientations ×
 * 2 binarizers, keeping enough resolution for the fine bars.
 */
async function decodeBarcode(file: File): Promise<string | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    // Cap the LONGEST side (not just width) so a portrait photo keeps detail.
    const maxSide = 2600;
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const base = document.createElement('canvas');
    base.width = w;
    base.height = h;
    const bctx = base.getContext('2d');
    if (!bctx) return null;
    bctx.drawImage(img, 0, 0, w, h);

    for (const deg of [0, 90, 180, 270]) {
      const rotated = rotateCanvas(base, deg);
      const l = luminanceOf(rotated);
      if (!l) continue;
      const text = tryDecode(new RGBLuminanceSource(l.lum, l.w, l.h));
      if (text) return text;
    }
    return null;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function LicenseScan({ onFields, className = '', label }: { onFields: (f: BorrowerAutofill) => void; className?: string; label?: string }) {
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
        onFields(data.fields as BorrowerAutofill);
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
        {status === 'reading' ? 'Reading licence…' : label || 'Scan driver’s licence'}
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
