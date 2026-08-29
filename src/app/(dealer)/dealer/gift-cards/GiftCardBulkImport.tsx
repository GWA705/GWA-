'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { bulkCreateGiftCardRequestsAction, type BulkRow } from './actions';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const TEMPLATE =
  'Customer name,Customer email,Customer cell,Card amount\n' +
  'Jane Doe,jane@example.com,705-555-0123,25\n' +
  'John Smith,john@example.com,,25\n';

interface ParsedRow extends BulkRow {
  _line: number;
  _error?: string;
}

// Minimal CSV parser: handles quoted fields, escaped quotes, and CRLF.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { cur.push(field); field = ''; }
    else if (c === '\n') { cur.push(field); rows.push(cur); cur = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); rows.push(cur); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

function toRows(text: string): ParsedRow[] {
  const grid = parseCsv(text);
  if (grid.length === 0) return [];
  // Detect a header row (contains "name" and "email"); otherwise assume the
  // template column order: name, email, cell, amount.
  const head = grid[0].map(norm);
  const hasHeader = head.some((h) => h.includes('name')) && head.some((h) => h.includes('email'));
  const col = { name: 0, email: 1, phone: 2, amount: 3 };
  if (hasHeader) {
    head.forEach((h, i) => {
      if (h.includes('name')) col.name = i;
      else if (h.includes('email')) col.email = i;
      else if (h.includes('cell') || h.includes('phone')) col.phone = i;
      else if (h.includes('amount') || h.includes('card')) col.amount = i;
    });
  }
  const body = hasHeader ? grid.slice(1) : grid;
  return body.map((cells, idx) => {
    const name = (cells[col.name] ?? '').trim();
    const email = (cells[col.email] ?? '').trim();
    const phone = (cells[col.phone] ?? '').trim();
    const amount = (cells[col.amount] ?? '').trim();
    const row: ParsedRow = { name, email, phone, amount, _line: idx + 2 };
    // Client-side pre-check (server re-validates before saving).
    const digits = phone.replace(/\D/g, '');
    if (!name) row._error = 'missing name';
    else if (!EMAIL_RE.test(email.toLowerCase())) row._error = 'invalid email';
    else if (phone && digits.length < 10) row._error = 'cell too short';
    else if (amount && !(Number(amount.replace(/[$,\s]/g, '')) > 0)) row._error = 'bad amount';
    return row;
  });
}

function download(name: string, text: string) {
  const blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export function GiftCardBulkImport() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState<{ created: number; errors: string[] } | null>(null);
  const [pending, start] = useTransition();

  const valid = rows?.filter((r) => !r._error) ?? [];
  const invalid = rows?.filter((r) => r._error) ?? [];

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    setResult(null);
    const text = await f.text();
    setRows(toRows(text));
  }

  function reset() {
    setRows(null);
    setFileName('');
    setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  function submit() {
    if (valid.length === 0) return;
    start(async () => {
      const res = await bulkCreateGiftCardRequestsAction(valid.map(({ name, email, phone, amount }) => ({ name, email, phone, amount })));
      setResult(res);
      if (res.created > 0) {
        reset();
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between text-left">
        <span className="text-sm font-semibold text-gray-800">📄 Add several at once (spreadsheet)</span>
        <span className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden>▾</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-gray-600">
            Did a batch of water tests? Download the template, fill in a row per customer, and upload it — we’ll create all
            the requests at once. Cell and amount are optional (amount defaults to $25).
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => download('gift-card-template.csv', TEMPLATE)} className="btn-secondary text-sm">
              ⬇ Download template
            </button>
            <label className="btn-secondary cursor-pointer text-sm">
              ⬆ Upload filled sheet
              <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
            </label>
            {fileName && <span className="text-xs text-gray-500">{fileName}</span>}
          </div>

          {result && (
            <div className={`rounded-md p-2 text-sm ${result.created > 0 ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'}`}>
              {result.created > 0 && <div>✓ Added {result.created} request{result.created === 1 ? '' : 's'}.</div>}
              {result.errors.length > 0 && (
                <div className="mt-1">
                  <div className="font-medium">Skipped {result.errors.length} row{result.errors.length === 1 ? '' : 's'}:</div>
                  <ul className="mt-0.5 list-disc pl-5">{result.errors.map((er, i) => <li key={i}>{er}</li>)}</ul>
                </div>
              )}
            </div>
          )}

          {rows && (
            <div className="space-y-2">
              <div className="text-sm">
                <span className="font-medium text-green-700">{valid.length} ready</span>
                {invalid.length > 0 && <span className="text-red-600"> · {invalid.length} need fixing</span>}
              </div>
              <div className="max-h-64 overflow-auto rounded-lg border border-gray-200 bg-white">
                <table className="min-w-full divide-y divide-gray-100 text-xs">
                  <thead className="bg-gray-50 text-left uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-2 py-1.5">#</th><th className="px-2 py-1.5">Name</th><th className="px-2 py-1.5">Email</th>
                      <th className="px-2 py-1.5">Cell</th><th className="px-2 py-1.5">Amount</th><th className="px-2 py-1.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {rows.map((r) => (
                      <tr key={r._line} className={r._error ? 'bg-red-50/60' : ''}>
                        <td className="px-2 py-1.5 text-gray-400">{r._line}</td>
                        <td className="px-2 py-1.5">{r.name || <span className="text-gray-300">—</span>}</td>
                        <td className="px-2 py-1.5">{r.email || <span className="text-gray-300">—</span>}</td>
                        <td className="px-2 py-1.5">{r.phone || <span className="text-gray-300">—</span>}</td>
                        <td className="px-2 py-1.5 tabular-nums">{r.amount ? `$${String(r.amount).replace(/[$\s]/g, '')}` : '$25'}</td>
                        <td className="px-2 py-1.5">{r._error ? <span className="text-red-600">⚠ {r._error}</span> : <span className="text-green-600">✓</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={submit} disabled={pending || valid.length === 0} className="btn-primary text-sm">
                  {pending ? 'Adding…' : `Add ${valid.length} request${valid.length === 1 ? '' : 's'}`}
                </button>
                <button type="button" onClick={reset} className="text-xs text-gray-500 hover:underline">Clear</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
