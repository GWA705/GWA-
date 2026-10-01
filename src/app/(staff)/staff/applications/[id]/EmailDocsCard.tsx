'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { emailDocumentsToCustomerAction } from '@/app/(staff)/actions';

export interface EmailDocOption {
  id: string;
  title: string;
  sectionLabel: string;
}

/**
 * Confirmation-step action: email a stored library document (brochure / manual)
 * to the customer when they ask for one. Pick one or more files, optionally add a
 * note, and send — the files are attached and a record is saved to the customer
 * file.
 */
export function EmailDocsCard({
  applicationId,
  customerEmail,
  docs,
}: {
  applicationId: string;
  customerEmail: string;
  docs: EmailDocOption[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [email, setEmail] = useState(customerEmail);
  const [message, setMessage] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const visible = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n ? docs.filter((d) => d.title.toLowerCase().includes(n) || d.sectionLabel.toLowerCase().includes(n)) : docs;
  }, [docs, q]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function send() {
    setMsg(null);
    start(async () => {
      const r = await emailDocumentsToCustomerAction(applicationId, Array.from(selected), message, email);
      if (r.error) { setMsg({ kind: 'err', text: r.error }); return; }
      setMsg({ kind: 'ok', text: `Sent to ${r.sentTo} — it's saved to the customer file.` });
      setSelected(new Set());
      setMessage('');
      router.refresh();
    });
  }

  if (docs.length === 0) return null; // nothing in the library to send

  return (
    <div className="mt-3 rounded-xl border border-gray-200 bg-white p-4">
      {!open ? (
        <div>
          <button
            type="button"
            onClick={() => { setOpen(true); setMsg(null); }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <span aria-hidden>📎</span> Email a brochure or manual
          </button>
          <p className="mt-1 text-xs text-gray-500">Customer asked for a brochure or manual? Send it to them from the Product Library.</p>
        </div>
      ) : (
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Email a brochure or manual to the customer</h3>

          <label className="mt-2 block text-xs font-medium text-gray-700">Send to</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="customer@email.com"
            className="input mt-1 w-full text-sm"
          />

          <label className="mt-3 block text-xs font-medium text-gray-700">Choose document(s)</label>
          {docs.length > 6 && (
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search the library…"
              className="input mt-1 w-full text-sm"
            />
          )}
          <div className="mt-1.5 max-h-56 overflow-auto rounded-md border border-gray-200">
            {visible.length === 0 ? (
              <p className="p-3 text-xs text-gray-500">No documents match.</p>
            ) : (
              visible.map((d) => (
                <label key={d.id} className="flex cursor-pointer items-center gap-2 border-b border-gray-100 px-3 py-2 text-sm last:border-0 hover:bg-gray-50">
                  <input type="checkbox" checked={selected.has(d.id)} onChange={() => toggle(d.id)} />
                  <span className="min-w-0 flex-1 truncate text-gray-800">{d.title}</span>
                  <span className="badge bg-gray-100 text-gray-500">{d.sectionLabel}</span>
                </label>
              ))
            )}
          </div>

          <label className="mt-3 block text-xs font-medium text-gray-700">Add a note (optional)</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            placeholder="e.g. Here's the manual for your new system — let us know if you have any questions!"
            className="input mt-1 w-full text-sm"
          />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={send}
              disabled={pending || selected.size === 0 || !email.trim()}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {pending ? 'Sending…' : `Send ${selected.size || ''} to customer`}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="px-2 py-2 text-sm text-gray-500 hover:underline">cancel</button>
          </div>
        </div>
      )}

      {msg && (
        <p className={`mt-3 rounded-md border-l-4 p-2 text-xs ${msg.kind === 'ok' ? 'border-green-500 bg-green-50 text-green-800' : 'border-red-500 bg-red-50 text-red-800'}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
