'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { sendMailAction, type MailActionState } from './actions';
import { friendlyFileName } from '@/lib/filenames';

const initial: MailActionState = {};

function splitName(name: string): { base: string; ext: string } {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? { base: name.slice(0, dot), ext: name.slice(dot) } : { base: name, ext: '' };
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Sending…' : 'Send mail'}
    </button>
  );
}

interface DealerOption {
  id: string;
  name: string;
}

export function MailComposeForm({ dealers }: { dealers: DealerOption[] }) {
  const [state, action] = useFormState(sendMailAction, initial);
  const [allDealers, setAllDealers] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [query, setQuery] = useState('');
  // Track selection in state so checking a dealer, then filtering the list,
  // doesn't drop the selection when its checkbox unmounts.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const q = query.trim().toLowerCase();
  const shown = q ? dealers.filter((d) => d.name.toLowerCase().includes(q)) : dealers;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <form action={action} className="space-y-5">
      {state.error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {state.error}
        </div>
      )}

      <div>
        <label className="label" htmlFor="senderLabel">From <span className="font-normal text-gray-400">(name dealers see)</span></label>
        <input id="senderLabel" name="senderLabel" className="input" maxLength={80} defaultValue="GWA" />
      </div>

      <div>
        <label className="label" htmlFor="subject">Subject</label>
        <input id="subject" name="subject" className="input" maxLength={200} />
      </div>

      <div>
        <label className="label" htmlFor="body">Message</label>
        <textarea id="body" name="body" rows={6} className="input" />
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <span className="label">Send to</span>
          {!allDealers && selected.size > 0 && (
            <button type="button" onClick={() => setSelected(new Set())} className="text-xs text-brand-700 hover:underline">
              Clear {selected.size} selected
            </button>
          )}
        </div>
        <label className="mb-2 flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" name="allDealers" checked={allDealers} onChange={(e) => setAllDealers(e.target.checked)} className="h-4 w-4" />
          All dealers
        </label>
        {!allDealers && (
          <>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${dealers.length} dealers…`}
              className="input mb-2"
              aria-label="Filter dealers"
            />
            <div className="mt-1 max-h-[28rem] space-y-3 overflow-y-auto rounded-md border border-gray-200 p-3">
              {dealers.length === 0 && <p className="text-xs text-gray-400">No active dealers.</p>}
              {dealers.length > 0 && shown.length === 0 && (
                <p className="text-xs text-gray-400">No dealers match “{query}”.</p>
              )}
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {shown.map((d) => (
                  <label key={d.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-gray-50">
                    <input type="checkbox" checked={selected.has(d.id)} onChange={() => toggle(d.id)} className="h-4 w-4" />
                    <span className="truncate">{d.name}</span>
                  </label>
                ))}
              </div>
            </div>
            {/* Selected ids submit here so filtering the list never drops them. */}
            {[...selected].map((id) => (
              <input key={id} type="hidden" name="dealerIds" value={id} />
            ))}
          </>
        )}
      </div>

      <div>
        <label className="label" htmlFor="files">Attachments <span className="font-normal text-gray-400">(PDF or images)</span></label>
        <input
          id="files"
          name="files"
          type="file"
          multiple
          accept="application/pdf,image/*"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
        />
        {files.length > 0 && (
          <div className="mt-3 space-y-2 rounded-md border border-gray-200 p-3">
            <p className="text-xs text-gray-500">Give each file a name dealers will see (optional):</p>
            {files.map((f, i) => {
              const { base, ext } = splitName(f.name);
              return (
                <div key={`${i}-${f.name}`} className="flex items-center gap-2">
                  <input
                    name="fileNames"
                    defaultValue={splitName(friendlyFileName(f.name)).base}
                    placeholder={base}
                    className="input flex-1 text-sm"
                    aria-label={`Name for ${f.name}`}
                  />
                  {ext && <span className="shrink-0 text-xs text-gray-400">{ext}</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <label className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
        <input type="checkbox" name="requireAck" className="mt-0.5 h-4 w-4" />
        <span>
          <span className="font-medium">Require acknowledgement</span> — ask each dealer user to confirm they&apos;ve read this. Use for sensitive or important information.
        </span>
      </label>

      <label className="flex items-start gap-2 rounded-md bg-green-50 p-3 text-sm text-green-900">
        <input type="checkbox" name="allowReplies" className="mt-0.5 h-4 w-4" />
        <span>
          <span className="font-medium">Allow replies</span> — let dealers reply to this message. Their replies come back here as a thread (one per dealer). Leave off for read-only announcements.
        </span>
      </label>

      <label className="flex items-start gap-2 rounded-md bg-brand-50 p-3 text-sm text-brand-900">
        <input type="checkbox" name="distributorsOnly" className="mt-0.5 h-4 w-4" />
        <span>
          <span className="font-medium">Distributors only</span> — send only to the distributor (owner / main contact) at each selected dealer, not every user there.
        </span>
      </label>

      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}
