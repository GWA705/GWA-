'use client';

import { useEffect, useRef, useTransition } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { uploadCaseFileAction, addCaseLinkAction, deleteCaseAttachmentAction, type CaseFormState } from './actions';
import { DocViewer } from '@/components/DocViewer';
import type { CaseAttachmentVM } from '@/lib/resolutionCases';

function Btn({ idle, busy }: { idle: string; busy: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn-secondary text-sm" disabled={pending}>{pending ? busy : idle}</button>;
}

export function CaseAttachments({ caseId, attachments }: { caseId: string; attachments: CaseAttachmentVM[] }) {
  const router = useRouter();
  const [upState, upAction] = useFormState(uploadCaseFileAction.bind(null, caseId), {} as CaseFormState);
  const [lnState, lnAction] = useFormState(addCaseLinkAction.bind(null, caseId), {} as CaseFormState);
  const upRef = useRef<HTMLFormElement>(null);
  const lnRef = useRef<HTMLFormElement>(null);
  const [, startDel] = useTransition();

  useEffect(() => { if (upState.ok) { upRef.current?.reset(); router.refresh(); } }, [upState, router]);
  useEffect(() => { if (lnState.ok) { lnRef.current?.reset(); router.refresh(); } }, [lnState, router]);

  function remove(id: string) {
    if (!window.confirm('Remove this attachment from the case?')) return;
    startDel(async () => { await deleteCaseAttachmentAction(id); router.refresh(); });
  }

  return (
    <div className="space-y-3">
      {/* List */}
      {attachments.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400">No files or links added to this case yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2">
              {a.kind === 'file' ? (
                <DocViewer
                  id={a.id}
                  fileName={a.label}
                  mimeType={a.mime}
                  src={`/api/resolutions/attachments/${a.id}`}
                  title={a.label}
                  className="min-w-0 flex-1 truncate rounded-md bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100 dark:bg-sky-900/30 dark:text-sky-300"
                >
                  📎 {a.label} ↗
                </DocViewer>
              ) : (
                <a href={a.url ?? '#'} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate rounded-md bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700 hover:bg-violet-100 dark:bg-violet-900/30 dark:text-violet-300">
                  🔗 {a.label} ↗
                </a>
              )}
              <span className="shrink-0 text-xs text-gray-400 dark:text-slate-500">{a.addedBy}</span>
              <button type="button" onClick={() => remove(a.id)} className="shrink-0 text-xs text-gray-400 hover:text-red-600">✕</button>
            </li>
          ))}
        </ul>
      )}

      {/* Upload a file */}
      <form ref={upRef} action={upAction} className="flex flex-wrap items-end gap-2 border-t border-gray-100 pt-3 dark:border-slate-700">
        <div className="min-w-0">
          <label className="label" htmlFor="file">Add a file</label>
          <input id="file" type="file" name="file" accept="application/pdf,image/*" required className="block text-sm" />
        </div>
        <input name="label" placeholder="Label (optional)" className="input max-w-[180px]" />
        <Btn idle="Upload" busy="Uploading…" />
        {upState.error && <p className="w-full text-xs text-red-600">{upState.error}</p>}
      </form>

      {/* Add a resource link */}
      <form ref={lnRef} action={lnAction} className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <label className="label" htmlFor="url">Add a resource link</label>
          <input id="url" name="url" placeholder="https://…" className="input" />
        </div>
        <input name="label" placeholder="Label" className="input max-w-[180px]" />
        <Btn idle="Add link" busy="Adding…" />
        {lnState.error && <p className="w-full text-xs text-red-600">{lnState.error}</p>}
      </form>
    </div>
  );
}
