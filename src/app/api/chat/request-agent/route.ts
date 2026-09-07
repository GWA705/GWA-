import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { canAccessConversation, requestHumanAgent } from '@/lib/chat';
import { getLocale } from '@/i18n/server';

export const dynamic = 'force-dynamic';

// Dealer taps "Talk to a person": flag the support thread for the team and pause
// the assistant. SUPPORT threads only.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  let conversationId: string | undefined;
  try {
    ({ conversationId } = await req.json());
  } catch {
    return new NextResponse('Bad request', { status: 400 });
  }
  if (!conversationId) return NextResponse.json({ error: 'Missing conversation.' }, { status: 400 });

  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, dealerId: true, kind: true },
  });
  if (!conv) return new NextResponse('Not found', { status: 404 });
  if (!canAccessConversation(session, conv)) return new NextResponse('Forbidden', { status: 403 });
  if (conv.kind !== 'SUPPORT') return NextResponse.json({ error: 'Not a support thread.' }, { status: 400 });

  await requestHumanAgent(conv.id, getLocale() === 'fr' ? 'fr' : 'en');
  return NextResponse.json({ ok: true });
}
