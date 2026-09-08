'use client';

import { useEffect, useRef, useState } from 'react';
import { ScanLine, Loader2, CheckCircle2, AlertTriangle, X, ImageUp } from 'lucide-react';
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

/**
 * Driver's-licence scan → autofill. PRIMARY path is a LIVE camera scan: we stream
 * the camera and decode the PDF417 barcode (back of the licence) frame-by-frame
 * until it locks on — far more reliable than a single still photo. Everything is
 * on-device; nothing is uploaded. Fallbacks: upload a photo (still decode), and if
 * no barcode reads, the image goes to /api/scan-id (Textract AnalyzeID, front of
 * licence) which extracts fields and stores nothing. The dealer reviews before
 * submitting.
 */

type Status = 'idle' | 'reading' | 'ok' | 'fail';

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
  for (const makeBin of [() => new HybridBinarizer(source), () => new GlobalHistogramBinarizer(source)]) {
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

/** Try to decode a PDF417 from a canvas at the given rotations. */
function decodeCanvas(canvas: HTMLCanvasElement, rotations: number[]): string | null {
  for (const deg of rotations) {
    const rot = rotateCanvas(canvas, deg);
    const l = luminanceOf(rot);
    if (!l) continue;
    const text = tryDecode(new RGBLuminanceSource(l.lum, l.w, l.h));
    if (text) return text;
  }
  return null;
}

/** Draw a video/image element to a canvas, capping the longest side. */
function frameToCanvas(el: HTMLVideoElement | HTMLImageElement, srcW: number, srcH: number, maxSide: number): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d')?.drawImage(el, 0, 0, w, h);
  return c;
}

/** Decode a PDF417 barcode from a still photo (4 rotations × 2 binarizers). */
async function decodeBarcode(file: File): Promise<string | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const base = frameToCanvas(img, img.width, img.height, 2600);
    return decodeCanvas(base, [0, 90, 180, 270]);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function LicenseScan({ onFields, className = '', label }: { onFields: (f: BorrowerAutofill) => void; className?: string; label?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [msg, setMsg] = useState('');
  const [camOpen, setCamOpen] = useState(false);

  function stopCamera() {
    scanningRef.current = false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((tk) => tk.stop());
    streamRef.current = null;
    const v = videoRef.current;
    if (v) v.srcObject = null;
  }

  function succeed(fields: BorrowerAutofill, source: 'barcode' | 'photo') {
    stopCamera();
    setCamOpen(false);
    onFields(fields);
    setStatus('ok');
    const name = `${fields.firstName ?? ''} ${fields.lastName ?? ''}`.replace(/\s+/g, ' ').trim();
    setMsg(source === 'barcode' ? `Scanned ${name || 'the licence'}. Please review the filled fields.` : 'Filled from the licence photo. Please review each field.');
  }

  // Live camera loop: start when the overlay opens, tear down on close/unmount.
  useEffect(() => {
    if (!camOpen) return;
    let cancelled = false;
    setStatus('reading');
    setMsg('');

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((tk) => tk.stop());
          return;
        }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          v.setAttribute('playsinline', 'true');
          v.muted = true;
          await v.play().catch(() => {});
        }
        scanningRef.current = true;

        const loop = () => {
          if (!scanningRef.current) return;
          const vid = videoRef.current;
          if (vid && vid.videoWidth > 0) {
            const canvas = frameToCanvas(vid, vid.videoWidth, vid.videoHeight, 1600);
            // Live: try upright + upside-down only (fast); the dealer holds it level.
            const text = decodeCanvas(canvas, [0, 180]);
            if (text) {
              const fields = parseAamva(text);
              if (fields) {
                succeed(fields, 'barcode');
                return;
              }
            }
          }
          timerRef.current = window.setTimeout(loop, 200);
        };
        loop();
      } catch {
        setCamOpen(false);
        setStatus('fail');
        setMsg('Couldn’t open the camera. Use “Upload a photo” of the back instead, or check camera permissions.');
      }
    })();

    return () => {
      cancelled = true;
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camOpen]);

  // Still-photo / cloud fallback path.
  async function handleFile(file: File) {
    setStatus('reading');
    setMsg('');
    const payload = await decodeBarcode(file);
    if (payload) {
      const fields = parseAamva(payload);
      if (fields) {
        succeed(fields, 'barcode');
        return;
      }
    }
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch('/api/scan-id', { method: 'POST', body: fd });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok && data.fields) {
        succeed(data.fields as BorrowerAutofill, 'photo');
        return;
      }
    } catch {
      /* fall through */
    }
    setStatus('fail');
    setMsg("Couldn't read the licence. Try the live scanner on the BACK (barcode side) in good light, or enter the details manually.");
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
          e.target.value = '';
        }}
      />

      {/* One clean action — the live scanner. There's no separate "upload a
          photo" button by design; the scanner handles everything on-device. If
          the camera can't open, an upload fallback appears below so it's never a
          dead-end (and the overlay also offers "upload instead" while scanning). */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => { setStatus('idle'); setMsg(''); setCamOpen(true); }}
          disabled={status === 'reading' && !camOpen}
          className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:opacity-60"
        >
          {status === 'reading' && !camOpen ? <Loader2 size={16} className="animate-spin" /> : <ScanLine size={16} />}
          {label || 'Scan driver’s licence'}
        </button>
      </div>

      <p className="mt-1 text-xs text-gray-500">
        Point the camera at the <strong>barcode on the back</strong> of the licence — it scans automatically. Nothing is stored.
      </p>
      {status === 'ok' && (
        <p className="mt-1 flex items-center gap-1 text-xs font-medium text-emerald-700">
          <CheckCircle2 size={13} /> {msg}
        </p>
      )}
      {status === 'fail' && (
        <div className="mt-1">
          <p className="flex items-center gap-1 text-xs font-medium text-amber-700">
            <AlertTriangle size={13} /> {msg}
          </p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-800"
          >
            <ImageUp size={13} /> Upload a photo instead
          </button>
        </div>
      )}

      {/* Live camera overlay */}
      {camOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/90">
          <div className="flex items-center justify-between px-4 py-3 text-white">
            <span className="text-sm font-semibold">Scan the back of the licence</span>
            <button type="button" onClick={() => setCamOpen(false)} aria-label="Close scanner" className="rounded-full p-1.5 hover:bg-white/10">
              <X size={22} />
            </button>
          </div>
          <div className="relative flex-1 overflow-hidden">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
            {/* Guide frame */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-40 w-[86%] max-w-md rounded-xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 px-4 py-4 text-center text-sm text-white/90">
            <Loader2 size={16} className="animate-spin" /> Hold the barcode inside the box, well-lit and steady…
          </div>
          <div className="pb-6 text-center">
            <button
              type="button"
              onClick={() => { setCamOpen(false); inputRef.current?.click(); }}
              className="text-sm font-semibold text-white underline underline-offset-4"
            >
              Trouble scanning? Upload a photo instead
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
