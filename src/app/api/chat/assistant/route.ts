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
  isAwaitingHuman,
  postAutoReply,
  recentTurnsForAi,
} from '@/lib/chat';
import { aiConfigured, generateSupportReply } from '@/lib/ai';
import { getAssistantKnowledgeFor, ASSISTANT_AREAS, type AssistantArea } from '@/lib/settings';
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
  let context: string | undefined;
  try {
    ({ conversationId, context } = await req.json());
  } catch {
    return new NextResponse('Bad request', { status: 400 });
  }
  if (!conversationId) return NextResponse.json({ replied: false });
  // Which part of the portal the dealer is chatting from → area-specific knowledge.
  const area: AssistantArea = ASSISTANT_AREAS.some((a) => a.area === context)
    ? (context as AssistantArea)
    : 'general';

  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, dealerId: true, kind: true },
  });
  if (!conv) return new NextResponse('Not found', { status: 404 });
  if (!canAccessConversation(session, conv)) return new NextResponse('Forbidden', { status: 403 });

  // Assistant only answers dealers on the General support thread. An admin
  // "viewing as" a dealer counts as the dealer here (so view-as is testable).
  const actingAsStaff = isInternalRole(session.role) && !session.impersonating;
  if (actingAsStaff || conv.kind !== 'SUPPORT') return NextResponse.json({ replied: false });
  // Stand down if the dealer asked for a person, or a teammate is actively in it.
  if (await isAwaitingHuman(conv.id)) return NextResponse.json({ replied: false });
  if (await humanRepliedRecently(conv.id)) return NextResponse.json({ replied: false });

  const locale = getLocale() === 'fr' ? 'fr' : 'en';
  let replied = false;

  if (aiConfigured()) {
    const [turns, kb] = await Promise.all([recentTurnsForAi(conv.id), getAssistantKnowledgeFor(area)]);
    const reply = await generateSupportReply(turns, locale, kb.knowledge, kb.hint);
    if (reply) {
      await postAutoReply(conv.id, reply);
      replied = true;
      // Log the Q&A for the admin review/promote loop. `deferred` flags answers
      // where the assistant punted to a human — those are the knowledge gaps.
      const question = [...turns].reverse().find((t) => t.role === 'user')?.content ?? '';
      const deferred = /find (someone|a teammate|a member)|not (sure|certain)|team (who|can)[^.]{0,20}help|get back to you|look into/i.test(reply);
      if (question) {
        await prisma.assistantQa
          .create({ data: { dealerId: conv.dealerId, area, question: question.slice(0, 2000), answer: reply.slice(0, 4000), deferred } })
          .catch(() => {});
      }
    }
  }
  // No AI (or it failed): outside business hours, leave the offline note — once.
  if (!replied && isAfterHours() && !(await autoReplyOutstanding(conv.id))) {
    await postAutoReply(conv.id, AFTER_HOURS_REPLY[locale]);
    replied = true;
  }

  return NextResponse.json({ replied });
}
