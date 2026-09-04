import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { isInternalRole } from '@/lib/constants';
import { notifyNewNote } from '@/lib/notify';
import {
  canAccessConversation,
  getOrCreateDealConversation,
  getOrCreateSupportConversation,
  postChatMessage,
} from '@/lib/chat';

export const dynamic = 'force-dynamic';

// Send a chat message. The conversation is addressed by id (replying), by
// applicationId (a deal thread — created on first use), or kind=SUPPORT (a
// dealer's general thread).
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  let payload: { conversationId?: string; applicationId?: string; kind?: string; body?: string };
  try {
    payload = await req.json();
  } catch {
    return new NextResponse('Bad request', { status: 400 });
  }
  const body = (payload.body ?? '').trim();
  if (!body) return new NextResponse('Empty message', { status: 400 });

  // Resolve the target conversation.
  let conv: { id: string; dealerId: string } | null = null;
  if (payload.conversationId) {
    conv = await prisma.conversation.findUnique({ where: { id: payload.conversationId }, select: { id: true, dealerId: true } });
  } else if (payload.applicationId) {
    conv = await getOrCreateDealConversation(payload.applicationId);
  } else if (payload.kind === 'SUPPORT') {
    // The general thread belongs to a dealer; anyone with a dealerId (a dealer,
    // or an admin viewing as one) can open it. Staff reply by conversationId.
    if (!session.dealerId) return new NextResponse('Bad request', { status: 400 });
    conv = await getOrCreateSupportConversation(session.dealerId);
  }
  if (!conv) return new NextResponse('Conversation not found', { status: 404 });
  if (!canAccessConversation(session, conv)) return new NextResponse('Forbidden', { status: 403 });

  await postChatMessage({ conversationId: conv.id, user: session, body });

  // Notify the other party on a deal thread (same behaviour as the old deal
  // notes), so an offline dealer/reviewer still hears about a new message.
  const full = await prisma.conversation.findUnique({ where: { id: conv.id }, select: { applicationId: true } });
  if (full?.applicationId) {
    await notifyNewNote(full.applicationId, isInternalRole(session.role) ? 'REVIEWER' : 'DEALER_USER').catch(() => {});
  }

  return NextResponse.json({ conversationId: conv.id });
}
