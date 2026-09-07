import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { isInternalRole } from '@/lib/constants';
import {
  AFTER_HOURS_REPLY,
  autoReplyOutstanding,
  canAccessConversation,
  humanRepliedRecently,
  isAfterHours,
  postAutoReply,
  recentTurnsForAi,
} from '@/lib/chat';
import { aiConfigured, generateSupportReply } from '@/lib/ai';
import { getSetting, AI_SETTING_KEYS } from '@/lib/settings';
import { getLocale } from '@/i18n/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Generate the support assistant's reply for a dealer's General support message
// and post it. Called by the chat widget right after a send, and awaited by the
// browser — so the model call happens inside a real request (not a background
// task a redeploy could drop). Idempotency: skips if a teammate is active, and
// posts at most one after-hours note per burst.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  let conversationId: string | undefined;
  try {
    ({ conversationId } = await req.json());
  } catch {
    return new NextResponse('Bad request', { status: 400 });
  }
  if (!conversationId) return NextResponse.json({ replied: false });

  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, dealerId: true, kind: true },
  });
  if (!conv) return new NextResponse('Not found', { status: 404 });
  if (!canAccessConversation(session, conv)) return new NextResponse('Forbidden', { status: 403 });

  // Assistant only answers dealers on the General support thread.
  if (isInternalRole(session.role) || conv.kind !== 'SUPPORT') return NextResponse.json({ replied: false });
  // Don't talk over a teammate who's actively in the thread.
  if (await humanRepliedRecently(conv.id)) return NextResponse.json({ replied: false });

  const locale = getLocale() === 'fr' ? 'fr' : 'en';
  let replied = false;

  if (aiConfigured()) {
    const [turns, knowledge] = await Promise.all([
      recentTurnsForAi(conv.id),
      getSetting(AI_SETTING_KEYS.assistantKnowledge),
    ]);
    const reply = await generateSupportReply(turns, locale, knowledge);
    if (reply) {
      await postAutoReply(conv.id, reply);
      replied = true;
    }
  }
  // No AI (or it failed): outside business hours, leave the offline note — once.
  if (!replied && isAfterHours() && !(await autoReplyOutstanding(conv.id))) {
    await postAutoReply(conv.id, AFTER_HOURS_REPLY[locale]);
    replied = true;
  }

  return NextResponse.json({ replied });
}
