import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/session';
import { isInternalRole } from '@/lib/constants';
import { dealerConversationSummaries, staffConversationSummaries } from '@/lib/chat';

export const dynamic = 'force-dynamic';

// Conversation list + unread counts for the current user (dealer: their dealer;
// staff: all active conversations). Polled by the chat widget / inbox.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const search = req.nextUrl.searchParams.get('q') ?? undefined;
  const conversations = isInternalRole(session.role)
    ? await staffConversationSummaries(session.userId, { search })
    : session.dealerId
      ? await dealerConversationSummaries(session.dealerId, session.userId)
      : [];

  const totalUnread = conversations.reduce((s, c) => s + c.unread, 0);
  return NextResponse.json({ totalUnread, conversations });
}
