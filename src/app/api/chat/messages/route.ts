import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { canAccessConversation, conversationMessages, markConversationRead, getOrCreateDealConversation } from '@/lib/chat';

export const dynamic = 'force-dynamic';

// Messages for one conversation (oldest first). Address it by conversationId, or
// by applicationId (a deal thread — created on first view). Viewing a thread
// marks it read. Access is scoped: a dealer only reads their dealer's threads.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const conversationId = req.nextUrl.searchParams.get('conversationId');
  const applicationId = req.nextUrl.searchParams.get('applicationId');

  let conv: { id: string; dealerId: string } | null = null;
  if (conversationId) {
    conv = await prisma.conversation.findUnique({ where: { id: conversationId }, select: { id: true, dealerId: true } });
  } else if (applicationId) {
    conv = await getOrCreateDealConversation(applicationId);
  } else {
    return new NextResponse('Missing conversationId or applicationId', { status: 400 });
  }
  if (!conv) return new NextResponse('Not found', { status: 404 });
  if (!canAccessConversation(session, conv)) return new NextResponse('Forbidden', { status: 403 });

  const messages = await conversationMessages(conv.id, session);
  await markConversationRead(conv.id, session.userId);
  return NextResponse.json({ conversationId: conv.id, messages });
}
