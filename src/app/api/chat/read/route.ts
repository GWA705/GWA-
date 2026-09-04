import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { canAccessConversation, markConversationRead } from '@/lib/chat';

export const dynamic = 'force-dynamic';

// Mark a conversation read up to now for the current user (used when a thread
// is opened, so the unread badge clears without loading messages separately).
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  let payload: { conversationId?: string };
  try {
    payload = await req.json();
  } catch {
    return new NextResponse('Bad request', { status: 400 });
  }
  if (!payload.conversationId) return new NextResponse('Missing conversationId', { status: 400 });

  const conv = await prisma.conversation.findUnique({ where: { id: payload.conversationId }, select: { id: true, dealerId: true } });
  if (!conv) return new NextResponse('Not found', { status: 404 });
  if (!canAccessConversation(session, conv)) return new NextResponse('Forbidden', { status: 403 });

  await markConversationRead(payload.conversationId, session.userId);
  return NextResponse.json({ ok: true });
}
