'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface Msg {
  id: string;
  body: string;
  fromStaff: boolean;
  authorName: string;
  createdAt: string;
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/**
 * An embedded live conversation (messages + composer), polling for new
 * messages. Address it by conversationId (staff inbox) or applicationId (a deal
 * thread — resolved/created on load). Author names are already display-safe from
 * the API (dealers see "Reviewer").
 */
export function ConversationThread({
  conversationId: initialId,
  applicationId,
  heightClass = 'h-80',
  placeholder = 'Write a message…',
}: {
  conversationId?: string;
  applicationId?: string;
  heightClass?: string;
  placeholder?: string;
}) {
  const [conversationId, setConversationId] = useState<string | undefined>(initialId);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const q = conversationId
      ? `conversationId=${encodeURIComponent(conversationId)}`
      : applicationId
        ? `applicationId=${encodeURIComponent(applicationId)}`
        : null;
    if (!q) return;
    try {
      const r = await fetch(`/api/chat/messages?${q}`, { cache: 'no-store' });
      if (r.ok) {
        const data = await r.json();
        setConversationId(data.conversationId);
        setMessages(data.messages);
      }
    } catch {
      /* offline — keep last */
    } finally {
      setLoaded(true);
    }
  }, [conversationId, applicationId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const r = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, applicationId: conversationId ? undefined : applicationId, body }),
      });
      if (r.ok) {
        const data = await r.json();
        setConversationId(data.conversationId);
        setText('');
        await load();
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <div className={`${heightClass} space-y-3 overflow-y-auto bg-gray-50 p-4`}>
        {loaded && messages.length === 0 && <p className="text-center text-sm text-gray-400">No messages yet.</p>}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.fromStaff ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.fromStaff ? 'rounded-tl-sm bg-white text-gray-800 shadow-sm' : 'rounded-tr-sm bg-brand-600 text-white'}`}>
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
              <p className={`mt-1 text-[10px] ${m.fromStaff ? 'text-gray-400' : 'text-white/70'}`}>{m.authorName} · {fmtTime(m.createdAt)}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-end gap-2 border-t border-gray-200 bg-white p-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          rows={1}
          placeholder={placeholder}
          className="max-h-28 min-h-[40px] flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <button type="submit" disabled={sending || !text.trim()} className="btn-primary flex-none px-4 py-2 text-sm disabled:opacity-50">Send</button>
      </form>
    </div>
  );
}
