import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { canAccessConversation, clearSupportConversation } from '@/lib/chat';

export const dynamic = 'force-dynamic';

// Clear a General support thread's messages (start fresh). Scoped to SUPPORT
// threads only — deal threads keep their history. Anyone who can access the
// thread (the dealer, or staff/admin) may clear it.
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
  if (conv.kind !== 'SUPPORT') return NextResponse.json({ error: 'Only the support chat can be cleared here.' }, { status: 400 });

  await clearSupportConversation(conv.id);
  return NextResponse.json({ ok: true });
}
