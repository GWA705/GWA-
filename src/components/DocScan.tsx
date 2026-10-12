'use client';

import { useRef, useState } from 'react';
import { FileText, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { BorrowerAutofill } from '@/lib/autofill';
import { useT } from '@/i18n/client';

/**
 * Read an uploaded, filled credit application (photo or single-page PDF) and
 * auto-fill the form. Sends the file to /api/scan-doc (AWS Textract forms OCR);
 * the file is processed in memory and not stored. Falls back to a clear message
 * when Textract isn't enabled so the dealer can type instead.
 */

type Status = 'idle' | 'reading' | 'ok' | 'fail';

export function DocScan({
  onFields,
  className = '',
}: {
  onFields: (f: BorrowerAutofill, meta?: { uncertain?: string[] }) => void;
  className?: string;
}) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [msg, setMsg] = useState('');

  async function handleFile(file: File) {
    setStatus('reading');
    setMsg('');
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch('/api/scan-doc', { method: 'POST', body: fd });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok && data.fields) {
        const uncertain = Array.isArray(data.uncertain) ? (data.uncertain as string[]) : [];
        onFields(data.fields as BorrowerAutofill, { uncertain });
        setStatus('ok');
        setMsg(
          uncertain.length > 0
            ? t('dealParts.docScan.filledUncertain')
            : t('dealParts.docScan.filled'),
        );
        return;
      }
      if (data?.reason === 'not_enabled') {
        setStatus('fail');
        setMsg(t('dealParts.docScan.notEnabled'));
        return;
      }
      if (data?.reason === 'no_fields') {
        setStatus('fail');
        setMsg(t('dealParts.docScan.noFields'));
        return;
      }
    } catch {
      /* fall through */
    }
    setStatus('fail');
    setMsg(t('dealParts.docScan.readFail'));
  }

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
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
        {status === 'reading' ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
        {status === 'reading' ? t('dealParts.docScan.reading') : t('dealParts.docScan.scanButton')}
      </button>
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
