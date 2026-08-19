'use client';

import { useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { FileDropInput } from '@/components/FileDropInput';

interface UploadState {
  error?: string;
}
type BoundAction = (prev: UploadState, formData: FormData) => Promise<UploadState>;

function UploadButton({ disabled, label }: { disabled: boolean; label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full text-sm" disabled={pending || disabled}>
      {pending ? 'Uploading…' : label}
    </button>
  );
}

/**
 * One labeled drop box per paperwork type — the box you drop into IS the type,
 * so there's no dropdown to pick and nothing to mis-tag. Each box submits the
 * same reviewer-paperwork action with its own fixed category.
 */
function PaperworkBox({ action, type, label, scope }: { action: BoundAction; type: string; label: string; scope: string }) {
  const [state, formAction] = useFormState(action, {} as UploadState);
  const formRef = useRef<HTMLFormElement>(null);
  const [names, setNames] = useState<string[]>([]);
  const [customLabel, setCustomLabel] = useState('');

  const isOther = type === 'OTHER';
  const ready = names.length > 0 && (!isOther || customLabel.trim().length > 0);

  return (
    <form
      ref={formRef}
      action={async (fd) => {
        await formAction(fd);
        formRef.current?.reset();
        setCustomLabel('');
        setNames([]);
      }}
      className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm"
    >
      <input type="hidden" name="category" value={type} />
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-gray-800">{label}</span>
        {names.length > 0 && (
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
            {names.length} ready
          </span>
        )}
      </div>

      {isOther && (
        <input
          name="customLabel"
          className="input py-1.5 text-sm"
          placeholder="Name this document (e.g. Warranty)"
          value={customLabel}
          maxLength={40}
          autoComplete="off"
          onChange={(e) => setCustomLabel(e.target.value)}
        />
      )}

      <FileDropInput
        name="file"
        variant="compact"
        buttonLabel="Add files"
        hint="Drop here or tap"
        persistKey={`${scope}:${type}`}
        onFilesChange={setNames}
      />

      <UploadButton disabled={!ready} label={`Send to dealer`} />
      {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}

export function ReviewerPaperworkBoxes({
  action,
  categories,
  scope,
}: {
  action: BoundAction;
  categories: { type: string; label: string }[];
  // A per-deal key so staged files survive a remount without leaking between deals.
  scope: string;
}) {
  return (
    <div>
      <p className="mb-3 text-xs text-gray-500">
        Drop each file into its matching box, then send. No need to pick a type — the box is the type.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {categories.map((c) => (
          <PaperworkBox key={c.type} action={action} type={c.type} label={c.label} scope={scope} />
        ))}
      </div>
    </div>
  );
}
