'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { looksLikeCardNumber, CARD_REDACT_NOTICE } from '@/lib/cardGuard';

interface Summary {
  id: string;
  kind: 'DEAL' | 'SUPPORT';
  title: string;
  subtitle: string | null;
  applicationId: string | null;
  lastMessageAt: string;
  preview: string | null;
  unread: number;
}
interface Msg {
  id: string;
  body: string;
  fromStaff: boolean;
  authorName: string;
  createdAt: string;
}
type Active = { conversationId?: string; applicationId?: string; kind?: 'SUPPORT'; title: string };

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export function ChatWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'list' | 'thread'>('list');
  const [active, setActive] = useState<Active | null>(null);
  const [summary, setSummary] = useState<{ totalUnread: number; conversations: Summary[] }>({ totalUnread: 0, conversations: [] });
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [cardWarn, setCardWarn] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const onScroll = () => {
    const el = listRef.current;
    if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  };

  // Deal-aware: on a specific deal page, offer that deal's thread directly.
  const dealMatch = pathname?.match(/^\/dealer\/applications\/([^/]+)/);
  const dealAppId = dealMatch && dealMatch[1] !== 'new' ? dealMatch[1] : null;

  const loadSummary = useCallback(async () => {
    try {
      const r = await fetch('/api/chat/summary', { cache: 'no-store' });
      if (r.ok) setSummary(await r.json());
    } catch {
      /* offline — keep last state */
    }
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    try {
      const r = await fetch(`/api/chat/messages?conversationId=${encodeURIComponent(conversationId)}`, { cache: 'no-store' });
      if (r.ok) {
        const data = await r.json();
        setMessages(data.messages);
      }
    } catch {
      /* keep last */
    }
  }, []);

  // Poll the summary: briskly while open, quietly while closed.
  useEffect(() => {
    loadSummary();
    const ms = open ? 12000 : 30000;
    const t = setInterval(loadSummary, ms);
    return () => clearInterval(t);
  }, [open, loadSummary]);

  // Poll the open thread.
  useEffect(() => {
    if (view !== 'thread' || !active?.conversationId) return;
    loadMessages(active.conversationId);
    const t = setInterval(() => loadMessages(active.conversationId!), 6000);
    return () => clearInterval(t);
  }, [view, active?.conversationId, loadMessages]);

  useEffect(() => {
    const el = listRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages, view]);

  // Let other parts of the portal (e.g. the dashboard "Contact Support" card)
  // pop the chat open — straight into a support thread when asked.
  useEffect(() => {
    const onOpen = (e: Event) => {
      setOpen(true);
      const wantsSupport = (e as CustomEvent).detail?.support;
      if (wantsSupport) {
        const existing = summary.conversations.find((c) => c.kind === 'SUPPORT');
        if (existing) openThread({ conversationId: existing.id, title: existing.title });
        else openThread({ kind: 'SUPPORT', title: 'General support' });
      } else {
        setView('list');
      }
    };
    window.addEventListener('gwa:open-chat', onOpen);
    return () => window.removeEventListener('gwa:open-chat', onOpen);
    // openThread is stable enough for this handler; summary is read at fire time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary.conversations]);

  function openThread(a: Active) {
    setActive(a);
    setMessages([]);
    setView('thread');
    if (a.conversationId) loadMessages(a.conversationId);
  }

  async function send() {
    const body = text.trim();
    if (!body || !active || sending) return;
    // The server strips card numbers; let the sender know when that happens.
    setCardWarn(looksLikeCardNumber(body));
    setSending(true);
    try {
      const r = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: active.conversationId,
          applicationId: active.conversationId ? undefined : active.applicationId,
          kind: active.conversationId || active.applicationId ? undefined : 'SUPPORT',
          body,
        }),
      });
      if (r.ok) {
        const data = await r.json();
        setText('');
        const cid = data.conversationId as string;
        if (!active.conversationId) setActive({ ...active, conversationId: cid });
        await loadMessages(cid);
        loadSummary();
      }
    } finally {
      setSending(false);
    }
  }

  const badge = summary.totalUnread;

  return (
    <>
      {/* Launcher */}
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setView('list'); }}
        aria-label={open ? 'Close chat' : 'Open chat with the GWA team'}
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg transition hover:bg-brand-700"
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
        )}
        {!open && badge > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold">{badge > 9 ? '9+' : badge}</span>
        )}
      </button>

      {open && (
        <div className="fixed bottom-24 right-5 z-50 flex h-[520px] max-h-[calc(100vh-7rem)] w-[380px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center gap-2 bg-brand-600 px-4 py-3 text-white">
            {view === 'thread' ? (
              <button type="button" onClick={() => setView('list')} aria-label="Back" className="rounded p-1 hover:bg-white/10">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
              </button>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{view === 'thread' ? active?.title : 'GWA team chat'}</div>
              {view === 'list' && <div className="text-[11px] text-white/80">We usually reply the same day</div>}
            </div>
          </div>

          {view === 'list' ? (
            <div className="flex-1 overflow-y-auto">
              {dealAppId && !summary.conversations.some((c) => c.applicationId === dealAppId) && (
                <button
                  type="button"
                  onClick={() => openThread({ applicationId: dealAppId, title: 'This deal' })}
                  className="flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left hover:bg-gray-50"
                >
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-brand-50 text-brand-700 text-xs font-bold">HD</span>
                  <span className="min-w-0"><span className="block text-sm font-semibold text-gray-900">Chat about this deal</span><span className="block truncate text-xs text-gray-500">Start a message about the deal you&apos;re viewing</span></span>
                </button>
              )}
              {!summary.conversations.some((c) => c.kind === 'SUPPORT') && (
                <button
                  type="button"
                  onClick={() => openThread({ kind: 'SUPPORT', title: 'General support' })}
                  className="flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left hover:bg-gray-50"
                >
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-amber-100 text-amber-700 text-xs font-bold">?</span>
                  <span className="min-w-0"><span className="block text-sm font-semibold text-gray-900">General support</span><span className="block truncate text-xs text-gray-500">Ask the GWA team anything</span></span>
                </button>
              )}
              {summary.conversations.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => openThread({ conversationId: c.id, applicationId: c.applicationId ?? undefined, title: c.title })}
                  className="flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left hover:bg-gray-50"
                >
                  <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-full text-xs font-bold ${c.kind === 'SUPPORT' ? 'bg-amber-100 text-amber-700' : 'bg-brand-50 text-brand-700'}`}>
                    {c.kind === 'SUPPORT' ? '?' : 'HD'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-gray-900">{c.title}</span>
                      {c.unread > 0 && <span className="flex h-5 min-w-[20px] flex-none items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">{c.unread}</span>}
                    </span>
                    <span className="block truncate text-xs text-gray-500">{c.preview ?? 'No messages yet'}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <>
              <div ref={listRef} onScroll={onScroll} className="flex-1 space-y-3 overflow-y-auto bg-gray-50 p-4">
                {messages.length === 0 && <p className="text-center text-sm text-gray-400">No messages yet — say hello.</p>}
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.fromStaff ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.fromStaff ? 'rounded-tl-sm bg-white text-gray-800 shadow-sm' : 'rounded-tr-sm bg-brand-600 text-white'}`}>
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p className={`mt-1 text-[10px] ${m.fromStaff ? 'text-gray-400' : 'text-white/70'}`}>{m.authorName} · {fmtTime(m.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-200 p-3">
                {cardWarn && <p className="mb-2 rounded bg-amber-50 px-2 py-1.5 text-xs text-amber-800">{CARD_REDACT_NOTICE}</p>}
                <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-end gap-2">
                  <textarea
                    value={text}
                    onChange={(e) => { setText(e.target.value); if (cardWarn) setCardWarn(false); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                    rows={1}
                    placeholder="Write a message…"
                    className="max-h-28 min-h-[40px] flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                  <button type="submit" disabled={sending || !text.trim()} className="btn-primary flex-none px-4 py-2 text-sm disabled:opacity-50">Send</button>
                </form>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
