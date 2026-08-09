'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface UploadState {
  error?: string;
}
type BatchAction = (prev: UploadState, formData: FormData) => Promise<UploadState>;

interface Item {
  id: string;
  file: File;
  category: string;
  customLabel: string;
  url: string | null;
  isImage: boolean;
}

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.heic,.webp';

/**
 * One "snap & send" uploader for the dealer's funding package. Take photos or
 * choose files, tag each with a category (type a name for "Other"), then send
 * them all in a single submit. Replaces the per-document drop-cards so a phone
 * can add many pages quickly.
 */
export function FundingUploader({
  action,
  categories,
}: {
  action: BatchAction;
  categories: { type: string; label: string }[];
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const camRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const stamp = Date.now();
    const next: Item[] = Array.from(list).map((file, i) => ({
      id: `${stamp}-${i}-${file.name}`,
      file,
      category: '',
      customLabel: '',
      url: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
      isImage: file.type.startsWith('image/'),
    }));
    setItems((prev) => [...prev, ...next]);
    setError(null);
  }

  function update(id: string, patch: Partial<Item>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  function remove(id: string) {
    setItems((prev) => {
      const gone = prev.find((it) => it.id === id);
      if (gone?.url) URL.revokeObjectURL(gone.url);
      return prev.filter((it) => it.id !== id);
    });
  }

  const allTagged =
    items.length > 0 && items.every((it) => it.category && (it.category !== 'OTHER' || it.customLabel.trim().length > 0));

  function submit() {
    if (!allTagged) {
      setError('Tag every file with a category first.');
      return;
    }
    const fd = new FormData();
    for (const it of items) {
      fd.append('file', it.file);
      fd.append('category', it.category);
      fd.append('customLabel', it.category === 'OTHER' ? it.customLabel.trim() : '');
    }
    start(async () => {
      const res = await action({}, fd);
      if (res?.error) {
        setError(res.error);
        return;
      }
      items.forEach((it) => it.url && URL.revokeObjectURL(it.url));
      setItems([]);
      setError(null);
      router.refresh();
    });
  }

  return (
    <div>
      {/* Capture zone */}
      <div className="rounded-xl border-2 border-dashed border-brand-200 bg-brand-50 p-4 text-center">
        <p className="text-sm font-semibold text-gray-800">Add your documents</p>
        <p className="mb-1 text-xs text-gray-500">Snap each page or choose files — add as many as you like, tag them below.</p>
        <p className="mb-3 text-xs text-amber-700">⚠ Do not upload payment cards — Credit Cards, HD Consumer Cards, and FinanceIT one-time-use cards are automatically rejected.</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button type="button" className="btn-primary text-sm" onClick={() => camRef.current?.click()}>
            📷 Take photo
          </button>
          <button type="button" className="btn-secondary text-sm" onClick={() => fileRef.current?.click()}>
            📎 Choose files
          </button>
        </div>
        <input
          ref={camRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <input
          ref={fileRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <p className="mt-2 text-xs text-gray-400">PDF, JPG, PNG, HEIC or WEBP. Photos of one document are combined into a PDF.</p>
      </div>

      {/* Staged files */}
      {items.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">To send ({items.length})</p>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {items.map((it) => (
              <li key={it.id} className="relative rounded-lg border border-gray-200 bg-white p-2">
                <button
                  type="button"
                  onClick={() => remove(it.id)}
                  className="absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-xs text-white"
                  aria-label="Remove file"
                >
                  ✕
                </button>
                <div className="flex items-center gap-2.5">
                  <div className="flex h-12 w-12 flex-none items-center justify-center overflow-hidden rounded bg-gray-100 text-lg text-gray-400">
                    {it.isImage && it.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      '📄'
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-gray-500" title={it.file.name}>{it.file.name}</p>
                    <select
                      className="input mt-1 py-1 text-xs"
                      value={it.category}
                      onChange={(e) => update(it.id, { category: e.target.value })}
                    >
                      <option value="">Tag this…</option>
                      {categories.map((c) => (
                        <option key={c.type} value={c.type}>{c.label}</option>
                      ))}
                    </select>
                    {it.category === 'OTHER' && (
                      <input
                        className="input mt-1 py-1 text-xs"
                        placeholder="Name this document"
                        value={it.customLabel}
                        maxLength={40}
                        onChange={(e) => update(it.id, { customLabel: e.target.value })}
                      />
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex items-center justify-between gap-3">
            {error && <span className="text-xs text-red-600">{error}</span>}
            <button
              type="button"
              className="btn-primary ml-auto text-sm"
              onClick={submit}
              disabled={pending || !allTagged}
            >
              {pending ? 'Sending…' : `Send ${items.length} file${items.length === 1 ? '' : 's'} to reviewer →`}
            </button>
          </div>
        </div>
      )}
      {error && items.length === 0 && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
