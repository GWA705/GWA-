'use client';

import { useMemo, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { sendMailAction, type MailActionState } from './actions';
import { friendlyFileName } from '@/lib/filenames';
import { useT } from '@/i18n/client';

const initial: MailActionState = {};

function splitName(name: string): { base: string; ext: string } {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? { base: name.slice(0, dot), ext: name.slice(dot) } : { base: name, ext: '' };
}

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? t('mailCompose.sending') : t('mailCompose.send')}
    </button>
  );
}

interface DealerUser {
  id: string;
  name: string;
  isDistributor: boolean;
}
interface DealerOption {
  id: string;
  name: string;
  users: DealerUser[];
}

export function MailComposeForm({ dealers }: { dealers: DealerOption[] }) {
  const t = useT();
  const [state, action] = useFormState(sendMailAction, initial);
  const [allDealers, setAllDealers] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [query, setQuery] = useState('');
  // Whole-dealer selections (everyone at the dealer) and individual-user picks.
  const [dealerSel, setDealerSel] = useState<Set<string>>(new Set());
  const [userSel, setUserSel] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const q = query.trim().toLowerCase();
  const shown = useMemo(() => {
    if (!q) return dealers;
    return dealers.filter(
      (d) => d.name.toLowerCase().includes(q) || d.users.some((u) => u.name.toLowerCase().includes(q)),
    );
  }, [dealers, q]);

  function toggleDealer(id: string, users: DealerUser[]) {
    setDealerSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    // Selecting the whole dealer supersedes individual picks there.
    setUserSel((prev) => {
      const next = new Set(prev);
      users.forEach((u) => next.delete(u.id));
      return next;
    });
  }
  function toggleUser(userId: string) {
    setUserSel((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }
  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function clearAll() {
    setDealerSel(new Set());
    setUserSel(new Set());
  }

  const summary = allDealers
    ? t('mailCompose.allDealers')
    : [
        dealerSel.size
          ? t(dealerSel.size === 1 ? 'mailCompose.dealerOne' : 'mailCompose.dealerMany', { n: dealerSel.size })
          : '',
        userSel.size
          ? t(userSel.size === 1 ? 'mailCompose.personOne' : 'mailCompose.personMany', { n: userSel.size })
          : '',
      ]
        .filter(Boolean)
        .join(' · ');

  return (
    <form action={action} className="space-y-5">
      {state.error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {state.error}
        </div>
      )}

      <div>
        <label className="label" htmlFor="senderLabel">{t('mailCompose.fromLabel')} <span className="font-normal text-gray-400">{t('mailCompose.fromHint')}</span></label>
        <input id="senderLabel" name="senderLabel" className="input" maxLength={80} defaultValue="Georgian Water & Air" />
      </div>

      <div>
        <label className="label" htmlFor="subject">{t('mailCompose.subjectLabel')}</label>
        <input id="subject" name="subject" className="input" maxLength={200} />
      </div>

      <div>
        <label className="label" htmlFor="body">{t('mailCompose.messageLabel')}</label>
        <textarea id="body" name="body" rows={6} className="input" />
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <span className="label">{t('mailCompose.sendToLabel')}</span>
          <span className="text-xs text-gray-500">
            {summary ? <>{t('mailCompose.sendingTo')} <span className="font-medium text-brand-700">{summary}</span></> : t('mailCompose.nobodySelected')}
            {!allDealers && (dealerSel.size > 0 || userSel.size > 0) && (
              <button type="button" onClick={clearAll} className="ml-3 text-brand-700 hover:underline">{t('mailCompose.clear')}</button>
            )}
          </span>
        </div>

        <label className="mb-2 flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" name="allDealers" checked={allDealers} onChange={(e) => setAllDealers(e.target.checked)} className="h-4 w-4" />
          {t('mailCompose.allDealers')} <span className="text-gray-400">{t('mailCompose.everyone')}</span>
        </label>

        {!allDealers && (
          <>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('mailCompose.searchPlaceholder', { n: dealers.length })}
              className="input mb-2"
              aria-label={t('mailCompose.filterAria')}
            />
            <div className="mt-1 max-h-[30rem] divide-y divide-gray-100 overflow-y-auto rounded-md border border-gray-200">
              {shown.length === 0 && <p className="p-3 text-xs text-gray-400">{t('mailCompose.noMatches', { query })}</p>}
              {shown.map((d) => {
                const whole = dealerSel.has(d.id);
                const pickedHere = d.users.filter((u) => userSel.has(u.id)).length;
                const isOpen = expanded.has(d.id) || (!!q && d.users.some((u) => u.name.toLowerCase().includes(q)));
                return (
                  <div key={d.id}>
                    <div className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50">
                      <label className="flex flex-1 items-center gap-2 text-sm">
                        <input type="checkbox" checked={whole} onChange={() => toggleDealer(d.id, d.users)} className="h-4 w-4" />
                        <span className="truncate font-medium text-gray-800">{d.name}</span>
                        {!whole && pickedHere > 0 && (
                          <span className="badge bg-brand-50 text-brand-700">{t('mailCompose.pickedBadge', { n: pickedHere })}</span>
                        )}
                      </label>
                      {d.users.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => toggleExpand(d.id)}
                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"
                          aria-expanded={isOpen}
                        >
                          {t(d.users.length === 1 ? 'mailCompose.personOne' : 'mailCompose.personMany', { n: d.users.length })}
                          <span className={`transition ${isOpen ? 'rotate-90' : ''}`} aria-hidden>›</span>
                        </button>
                      ) : (
                        <span className="text-xs text-gray-300">{t('mailCompose.noUsers')}</span>
                      )}
                    </div>
                    {isOpen && d.users.length > 0 && (
                      <div className="grid grid-cols-1 gap-0.5 bg-gray-50/60 px-3 pb-2 pl-9 sm:grid-cols-2">
                        {d.users.map((u) => (
                          <label key={u.id} className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-white">
                            <input
                              type="checkbox"
                              checked={whole || userSel.has(u.id)}
                              disabled={whole}
                              onChange={() => toggleUser(u.id)}
                              className="h-4 w-4"
                            />
                            <span className={`truncate ${whole ? 'text-gray-400' : 'text-gray-700'}`}>{u.name}</span>
                            {u.isDistributor && <span className="badge bg-purple-100 text-purple-800">{t('mailCompose.distributorBadge')}</span>}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="mt-1 text-xs text-gray-400">
              {t('mailCompose.pickHint')}
            </p>
            {/* Selections submit as hidden fields so filtering never drops them. */}
            {[...dealerSel].map((id) => (
              <input key={`d-${id}`} type="hidden" name="dealerIds" value={id} />
            ))}
            {[...userSel].map((id) => (
              <input key={`u-${id}`} type="hidden" name="userIds" value={id} />
            ))}
          </>
        )}
      </div>

      <div>
        <label className="label" htmlFor="files">{t('mailCompose.attachmentsLabel')} <span className="font-normal text-gray-400">{t('mailCompose.attachmentsHint')}</span></label>
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
            <p className="text-xs text-gray-500">{t('mailCompose.fileNamesHint')}</p>
            {files.map((f, i) => {
              const { base, ext } = splitName(f.name);
              return (
                <div key={`${i}-${f.name}`} className="flex items-center gap-2">
                  <input
                    name="fileNames"
                    defaultValue={splitName(friendlyFileName(f.name)).base}
                    placeholder={base}
                    className="input flex-1 text-sm"
                    aria-label={t('mailCompose.fileNameAria', { name: f.name })}
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
          <span className="font-medium">{t('mailCompose.requireAckTitle')}</span> {t('mailCompose.requireAckDesc')}
        </span>
      </label>

      <label className="flex items-start gap-2 rounded-md bg-green-50 p-3 text-sm text-green-900">
        <input type="checkbox" name="allowReplies" className="mt-0.5 h-4 w-4" />
        <span>
          <span className="font-medium">{t('mailCompose.allowRepliesTitle')}</span> {t('mailCompose.allowRepliesDesc')}
        </span>
      </label>

      <label className="flex items-start gap-2 rounded-md bg-brand-50 p-3 text-sm text-brand-900">
        <input type="checkbox" name="distributorsOnly" className="mt-0.5 h-4 w-4" />
        <span>
          <span className="font-medium">{t('mailCompose.distributorsOnlyTitle')}</span> {t('mailCompose.distributorsOnlyDesc')}
        </span>
      </label>

      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}
