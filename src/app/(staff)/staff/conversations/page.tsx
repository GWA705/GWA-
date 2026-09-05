import Link from 'next/link';
import { SectionHero } from '@/components/SectionHero';
import { requireRole } from '@/lib/session';
import { staffConversationSummaries } from '@/lib/chat';

export const dynamic = 'force-dynamic';

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default async function StaffConversationsPage({ searchParams }: { searchParams: { q?: string } }) {
  const user = await requireRole('REVIEWER', 'ADMIN');
  const q = (searchParams.q ?? '').trim();
  const conversations = await staffConversationSummaries(user.userId, { search: q || undefined });
  const totalUnread = conversations.reduce((s, c) => s + c.unread, 0);

  return (
    <div className="space-y-6">
      <SectionHero
        eyebrow="Reviewer"
        title="Conversations"
        subtitle={`Live chat with dealers — deal threads and general support.${totalUnread > 0 ? ` ${totalUnread} unread.` : ''}`}
      />
      <form className="flex items-center gap-2" action="/staff/conversations">
        <input name="q" defaultValue={q} placeholder="Search dealer or customer…" className="input h-9 w-64 text-sm" />
        <button type="submit" className="btn-secondary text-sm">Search</button>
      </form>

      {conversations.length === 0 ? (
        <div className="card p-8 text-center text-sm text-gray-500">No conversations yet.</div>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          {conversations.map((c) => (
            <li key={c.id} className="border-b border-gray-100 last:border-0">
              <Link href={`/staff/conversations/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-full text-xs font-bold ${c.kind === 'SUPPORT' ? 'bg-amber-100 text-amber-700' : 'bg-brand-50 text-brand-700'}`}>
                  {c.kind === 'SUPPORT' ? '?' : 'HD'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-semibold text-gray-900">{c.title}</span>
                    {c.unread > 0 && <span className="flex h-5 min-w-[20px] flex-none items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">{c.unread}</span>}
                  </span>
                  <span className="block truncate text-xs text-gray-500">{c.subtitle ? `${c.subtitle} · ` : ''}{c.preview ?? 'No messages'}</span>
                </span>
                <span className="flex-none text-xs text-gray-400">{fmtTime(c.lastMessageAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
