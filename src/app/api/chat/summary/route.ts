import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/session';
import { dealerConversationSummaries, staffConversationSummaries } from '@/lib/chat';

export const dynamic = 'force-dynamic';

// Conversation list + unread counts for the current user (dealer: their dealer;
// staff: all active conversations). Polled by the chat widget / inbox.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const search = req.nextUrl.searchParams.get('q') ?? undefined;
  // A dealerId (real dealer, or an admin viewing as one) → that dealer's
  // conversations (ensuring General support exists); otherwise the staff list.
  const conversations = session.dealerId
    ? await dealerConversationSummaries(session.dealerId, session.userId)
    : await staffConversationSummaries(session.userId, { search });

  const totalUnread = conversations.reduce((s, c) => s + c.unread, 0);
  return NextResponse.json({ totalUnread, conversations });
}
