import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { isInternalRole } from '@/lib/constants';
import { redactCardNumbers } from '@/lib/cardGuard';
import { notifyNewNote } from '@/lib/notify';
import {
  AFTER_HOURS_REPLY,
  autoReplyOutstanding,
  canAccessConversation,
  getOrCreateDealConversation,
  getOrCreateSupportConversation,
  humanRepliedRecently,
  isAfterHours,
  postAutoReply,
  postChatMessage,
  recentTurnsForAi,
} from '@/lib/chat';
import { aiConfigured, generateSupportReply } from '@/lib/ai';
import { getLocale } from '@/i18n/server';

/**
 * Always-on support assistant for the General support thread. Runs in the
 * background after the dealer's message is saved (so sending stays instant; the
 * reply lands on the widget's next poll). Stays quiet when a teammate is actively
 * in the thread, so a person can take over. Falls back to the static after-hours
 * note when the AI is unavailable.
 */
async function runSupportAssistant(conversationId: string, locale: 'en' | 'fr'): Promise<void> {
  try {
    if (await humanRepliedRecently(conversationId)) return; // a person is handling it
    if (aiConfigured()) {
      const turns = await recentTurnsForAi(conversationId);
      const reply = await generateSupportReply(turns, locale);
      if (reply) {
        await postAutoReply(conversationId, reply);
        return;
      }
    }
    // No AI (or it failed): outside business hours, leave the offline note — once.
    if (isAfterHours() && !(await autoReplyOutstanding(conversationId))) {
      await postAutoReply(conversationId, AFTER_HOURS_REPLY[locale]);
    }
  } catch {
    /* assistant is best-effort — never affect the dealer's send */
  }
}

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
  // Strip any full card number before the message is ever stored.
  const body = redactCardNumbers((payload.body ?? '').trim());
  if (!body) return NextResponse.json({ error: 'Type a message first.' }, { status: 400 });

  // Resolve the target conversation.
  let conv: { id: string; dealerId: string } | null = null;
  if (payload.conversationId) {
    conv = await prisma.conversation.findUnique({ where: { id: payload.conversationId }, select: { id: true, dealerId: true } });
  } else if (payload.applicationId) {
    conv = await getOrCreateDealConversation(payload.applicationId);
  } else if (payload.kind === 'SUPPORT') {
    // The general thread belongs to a dealer; anyone with a dealerId (a dealer,
    // or an admin viewing as one) can open it. Staff reply by conversationId.
    if (!session.dealerId) {
      return NextResponse.json(
        { error: 'General support chat is for dealer accounts. As GWA staff, open a dealer’s thread from the Conversations inbox to reply.' },
        { status: 400 },
      );
    }
    conv = await getOrCreateSupportConversation(session.dealerId);
  }
  if (!conv) return NextResponse.json({ error: 'That conversation could not be found.' }, { status: 404 });
  if (!canAccessConversation(session, conv)) return NextResponse.json({ error: 'You don’t have access to that conversation.' }, { status: 403 });

  await postChatMessage({ conversationId: conv.id, user: session, body });

  // Support assistant: for a dealer's message in the General support thread, let
  // the assistant reply. Locale is read now (in request scope); the work runs in
  // the background so the dealer's send returns immediately.
  const meta = await prisma.conversation.findUnique({ where: { id: conv.id }, select: { kind: true } });
  if (!isInternalRole(session.role) && meta?.kind === 'SUPPORT') {
    const locale = getLocale() === 'fr' ? 'fr' : 'en';
    void runSupportAssistant(conv.id, locale);
  }

  // Notify the other party on a deal thread (same behaviour as the old deal
  // notes), so an offline dealer/reviewer still hears about a new message.
  const full = await prisma.conversation.findUnique({ where: { id: conv.id }, select: { applicationId: true } });
  if (full?.applicationId) {
    await notifyNewNote(full.applicationId, isInternalRole(session.role) ? 'REVIEWER' : 'DEALER_USER').catch(() => {});
  }

  return NextResponse.json({ conversationId: conv.id });
}
