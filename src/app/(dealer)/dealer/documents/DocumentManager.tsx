'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { FileText, UploadCloud, CheckCircle2, AlertTriangle, Clock, Loader2, Trash2, ScanLine } from 'lucide-react';
import { uploadDocumentAction, deleteDocumentAction, type DocActionState } from './actions';
import type { DocStatus } from '@/lib/dealerDocs';

export interface DocVM {
  id: string;
  type: string;
  label: string | null;
  fileName: string;
  expiryDate: string | null; // ISO yyyy-mm-dd
  accountNumber: string | null;
  status: DocStatus;
  daysLeft: number | null;
  statusText: string;
  uploadedAt: string;
  autoExtracted: boolean;
}

export interface SlotVM {
  key: string;
  label: string;
  description?: string;
  hasAccountNumber?: boolean;
  accountLabel?: string;
  current: DocVM | null;
}

const OTHER = 'OTHER';
const initial: DocActionState = {};

const STATUS_STYLES: Record<DocStatus, { chip: string; Icon: typeof CheckCircle2 }> = {
  valid: { chip: 'bg-green-100 text-green-800', Icon: CheckCircle2 },
  expiring: { chip: 'bg-amber-100 text-amber-800', Icon: Clock },
  expired: { chip: 'bg-red-100 text-red-700', Icon: AlertTriangle },
  missing: { chip: 'bg-gray-100 text-gray-600', Icon: FileText },
};

function StatusChip({ status, text }: { status: DocStatus; text: string }) {
  const { chip, Icon } = STATUS_STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${chip}`}>
      <Icon size={13} /> {text}
    </span>
  );
}

function SubmitButton({ isReplace }: { isReplace: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={pending}>
      {pending ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />}
      {pending ? 'Uploading…' : isReplace ? 'Replace document' : 'Upload document'}
    </button>
  );
}

/** The upload form for one document (a fixed slot or a new "other" document). */
function UploadForm({
  type,
  isOther,
  isReplace = false,
  hasAccountNumber,
  accountLabel,
  currentAccount,
  onDone,
}: {
  type: string;
  isOther: boolean;
  isReplace?: boolean;
  hasAccountNumber?: boolean;
  accountLabel?: string;
  currentAccount?: string | null;
  onDone?: () => void;
}) {
  const [state, action] = useFormState(uploadDocumentAction, initial);
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState<string | null>(null);
  const [expiry, setExpiry] = useState('');
  const [account, setAccount] = useState(currentAccount ?? '');
  const [scannedDates, setScannedDates] = useState('');
  const [autoExtracted, setAutoExtracted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // On a successful save, let the server revalidate the list, then collapse.
  useEffect(() => {
    if (!state.ok) return;
    const id = setTimeout(() => onDone?.(), 500);
    return () => clearTimeout(id);
  }, [state.ok, onDone]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setScanNote(null);
    setAutoExtracted(false);
    setScannedDates('');
    if (!file) return;
    setScanning(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/scan-expiry', { method: 'POST', body: fd });
      const data = await res.json().catch(() => null);
      if (data?.ok) {
        if (data.expiry) {
          setExpiry(data.expiry);
          setAutoExtracted(true);
          setScanNote(`Detected expiry ${data.expiry} — please confirm it matches the document.`);
        } else {
          setScanNote('Couldn’t read a date automatically — please enter the expiry date below.');
        }
        if (Array.isArray(data.dates)) setScannedDates(data.dates.join(','));
        if (data.accountNumber && !account) setAccount(data.accountNumber);
      } else {
        setScanNote('Please enter the expiry date below.');
      }
    } catch {
      setScanNote('Please enter the expiry date below.');
    } finally {
      setScanning(false);
    }
  }

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="scannedDates" value={scannedDates} />
      <input type="hidden" name="autoExtracted" value={autoExtracted ? '1' : '0'} />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      {isOther && (
        <div>
          <label className="label">Document name</label>
          <input name="label" className="input" placeholder="e.g. General liability insurance" required />
        </div>
      )}

      <div>
        <label className="label">File <span className="font-normal text-gray-400">(PDF or image — max 10 MB)</span></label>
        <input
          name="file"
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*"
          onChange={onFile}
          required
          className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
        />
        {scanning && (
          <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-brand-700"><Loader2 size={13} className="animate-spin" /> Scanning the document for its expiry date…</p>
        )}
        {!scanning && scanNote && (
          <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-gray-600"><ScanLine size={13} /> {scanNote}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Expiry / renewal date {!isOther && <span className="text-amber-600">(required)</span>}</label>
          <input
            name="expiryDate"
            type="date"
            value={expiry}
            onChange={(e) => { setExpiry(e.target.value); setAutoExtracted(false); }}
            className="input"
            required={!isOther}
          />
        </div>
        {hasAccountNumber && (
          <div>
            <label className="label">{accountLabel || 'Account #'}</label>
            <input name="accountNumber" value={account} onChange={(e) => setAccount(e.target.value)} className="input" autoComplete="off" />
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton isReplace={isReplace} />
        {state.ok && <span className="inline-flex items-center gap-1 text-xs text-green-600"><CheckCircle2 size={14} /> Saved</span>}
      </div>
    </form>
  );
}

function CurrentFile({ doc }: { doc: DocVM }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <a href={`/api/dealer/documents/${doc.id}/file`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-medium text-brand-700 hover:underline">
        <FileText size={15} /> {doc.fileName}
      </a>
      <StatusChip status={doc.status} text={doc.statusText} />
      {doc.expiryDate && <span className="text-xs text-gray-500">Expires {doc.expiryDate}</span>}
      {doc.accountNumber && <span className="text-xs text-gray-400">Acct #{doc.accountNumber}</span>}
    </div>
  );
}

function SlotCard({ slot }: { slot: SlotVM }) {
  const [open, setOpen] = useState(!slot.current); // missing → open for upload
  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-gray-900">{slot.label}</h3>
          {slot.description && <p className="mt-0.5 text-xs text-gray-500">{slot.description}</p>}
        </div>
        {slot.current ? (
          <button type="button" onClick={() => setOpen((o) => !o)} className="text-sm font-medium text-brand-700 hover:underline">
            {open ? 'Cancel' : 'Replace'}
          </button>
        ) : (
          <StatusChip status="missing" text="Not uploaded" />
        )}
      </div>

      {slot.current && (
        <div className="mt-3">
          <CurrentFile doc={slot.current} />
        </div>
      )}

      {open && (
        <div className="mt-4 border-t border-gray-100 pt-4">
          <UploadForm
            type={slot.key}
            isOther={false}
            isReplace={!!slot.current}
            hasAccountNumber={slot.hasAccountNumber}
            accountLabel={slot.accountLabel}
            currentAccount={slot.current?.accountNumber ?? null}
            onDone={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
}

function OtherDoc({ doc }: { doc: DocVM }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 p-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-gray-900">{doc.label || doc.fileName}</div>
        <div className="mt-1"><CurrentFile doc={doc} /></div>
      </div>
      <form action={deleteDocumentAction}>
        <input type="hidden" name="id" value={doc.id} />
        <button type="submit" className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-red-600" aria-label="Delete document">
          <Trash2 size={14} /> Remove
        </button>
      </form>
    </div>
  );
}

export function DocumentManager({ slots, others }: { slots: SlotVM[]; others: DocVM[] }) {
  const [addOther, setAddOther] = useState(false);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {slots.map((s) => (
          <SlotCard key={s.key} slot={s} />
        ))}
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Other documents</h3>
            <p className="mt-0.5 text-xs text-gray-500">Trade licences, insurance certificates, CSST, RBQ — anything else with a renewal date.</p>
          </div>
          <button type="button" onClick={() => setAddOther((o) => !o)} className="text-sm font-medium text-brand-700 hover:underline">
            {addOther ? 'Cancel' : '+ Add a document'}
          </button>
        </div>

        {others.length > 0 && (
          <div className="mt-4 space-y-2">
            {others.map((d) => <OtherDoc key={d.id} doc={d} />)}
          </div>
        )}

        {addOther && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <UploadForm type={OTHER} isOther hasAccountNumber accountLabel="Account / policy #" onDone={() => setAddOther(false)} />
          </div>
        )}
      </div>
    </div>
  );
}
