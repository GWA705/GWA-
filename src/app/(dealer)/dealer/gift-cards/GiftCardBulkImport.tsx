'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { bulkCreateGiftCardRequestsAction, type BulkRow } from './actions';
import { useI18n } from '@/i18n/client';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
// English + French downloadable templates. Column ORDER is identical, so a sheet
// filled from either template imports the same way; the header row is only used
// to re-map columns if the office reorders them (see toRows).
const TEMPLATE_EN =
  'Customer name,Customer email,Customer cell,Card amount\n' +
  'Jane Doe,jane@example.com,705-555-0123,25\n' +
  'John Smith,john@example.com,,25\n';
const TEMPLATE_FR =
  'Nom du client,Courriel du client,Cellulaire du client,Montant de la carte\n' +
  'Jean Tremblay,jean@example.com,514-555-0123,25\n' +
  'Marie Roy,marie@example.com,,25\n';

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

// Lower-case, strip accents (é→e) and non-letters, so French headers like
// "Téléphone" / "Montant" normalise to plain ascii for matching.
const norm = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '');

// Header matchers accept both English and French column names.
const isName = (h: string) => h.includes('name') || h.includes('nom');
const isEmail = (h: string) => h.includes('email') || h.includes('courriel');
const isPhone = (h: string) => h.includes('cell') || h.includes('phone') || h.includes('telephone');
const isAmount = (h: string) => h.includes('amount') || h.includes('card') || h.includes('montant');

function toRows(text: string): ParsedRow[] {
  const grid = parseCsv(text);
  if (grid.length === 0) return [];
  // Detect a header row (has a recognisable name + email column in EN or FR);
  // otherwise assume the template column order: name, email, cell, amount.
  const head = grid[0].map(norm);
  const hasHeader = head.some(isName) && head.some(isEmail);
  const col = { name: 0, email: 1, phone: 2, amount: 3 };
  if (hasHeader) {
    head.forEach((h, i) => {
      if (isName(h)) col.name = i;
      else if (isEmail(h)) col.email = i;
      else if (isPhone(h)) col.phone = i;
      else if (isAmount(h)) col.amount = i;
    });
  }
  const body = hasHeader ? grid.slice(1) : grid;
  return body.map((cells, idx) => {
    const name = (cells[col.name] ?? '').trim();
    const email = (cells[col.email] ?? '').trim();
    const phone = (cells[col.phone] ?? '').trim();
    const amount = (cells[col.amount] ?? '').trim();
    const row: ParsedRow = { name, email, phone, amount, _line: idx + 2 };
    // Client-side pre-check (server re-validates before saving). Store a
    // translation key so the message renders in the viewer's language.
    const digits = phone.replace(/\D/g, '');
    if (!name) row._error = 'giftCards.errMissingName';
    else if (!EMAIL_RE.test(email.toLowerCase())) row._error = 'giftCards.errInvalidEmail';
    else if (phone && digits.length < 10) row._error = 'giftCards.errCellShort';
    else if (amount && !(Number(amount.replace(/[$,\s]/g, '')) > 0)) row._error = 'giftCards.errBadAmount';
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
  const { t, locale } = useI18n();
  const template = locale === 'fr' ? TEMPLATE_FR : TEMPLATE_EN;
  const templateName = locale === 'fr' ? 'modele-cartes-cadeaux.csv' : 'gift-card-template.csv';
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
        <span className="text-sm font-semibold text-gray-800">{t('giftCards.addSeveral')}</span>
        <span className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden>▾</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-gray-600">
            {t('giftCards.bulkIntro')}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => download(templateName, template)} className="btn-secondary text-sm">
              {t('giftCards.downloadTemplate')}
            </button>
            <label className="btn-secondary cursor-pointer text-sm">
              {t('giftCards.uploadSheet')}
              <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
            </label>
            {fileName && <span className="text-xs text-gray-500">{fileName}</span>}
          </div>

          {result && (
            <div className={`rounded-md p-2 text-sm ${result.created > 0 ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'}`}>
              {result.created > 0 && <div>{result.created === 1 ? t('giftCards.addedOne') : t('giftCards.addedMany', { n: result.created })}</div>}
              {result.errors.length > 0 && (
                <div className="mt-1">
                  <div className="font-medium">{result.errors.length === 1 ? t('giftCards.skippedOne') : t('giftCards.skippedMany', { n: result.errors.length })}</div>
                  <ul className="mt-0.5 list-disc pl-5">{result.errors.map((er, i) => <li key={i}>{er}</li>)}</ul>
                </div>
              )}
            </div>
          )}

          {rows && (
            <div className="space-y-2">
              <div className="text-sm">
                <span className="font-medium text-green-700">{t('giftCards.ready', { n: valid.length })}</span>
                {invalid.length > 0 && <span className="text-red-600"> · {t('giftCards.needFixing', { n: invalid.length })}</span>}
              </div>
              <div className="max-h-64 overflow-auto rounded-lg border border-gray-200 bg-white">
                <table className="min-w-full divide-y divide-gray-100 text-xs">
                  <thead className="bg-gray-50 text-left uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-2 py-1.5">{t('giftCards.colNum')}</th><th className="px-2 py-1.5">{t('giftCards.colName')}</th><th className="px-2 py-1.5">{t('giftCards.colEmail')}</th>
                      <th className="px-2 py-1.5">{t('giftCards.colCell')}</th><th className="px-2 py-1.5">{t('giftCards.colAmount')}</th><th className="px-2 py-1.5"></th>
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
                        <td className="px-2 py-1.5">{r._error ? <span className="text-red-600">⚠ {t(r._error)}</span> : <span className="text-green-600">✓</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={submit} disabled={pending || valid.length === 0} className="btn-primary text-sm">
                  {pending ? t('giftCards.adding') : valid.length === 1 ? t('giftCards.addOne') : t('giftCards.addMany', { n: valid.length })}
                </button>
                <button type="button" onClick={reset} className="text-xs text-gray-500 hover:underline">{t('giftCards.clear')}</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
