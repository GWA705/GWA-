import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireDealerAccess } from '@/lib/session';

export const dynamic = 'force-dynamic';

const VIEWS = ['tracker', 'pipeline', 'list', 'progress'];

/**
 * Records which Applications view a dealer switched to. Increments a per-user +
 * per-view counter (best-effort) — powers "remember my last view" and the
 * "which views are used most" analytics. Never blocks the UI.
 */
export async function POST(req: NextRequest) {
  const user = await requireDealerAccess();
  let view = '';
  try {
    view = String((await req.json())?.view ?? '');
  } catch {
    /* ignore */
  }
  if (!VIEWS.includes(view)) return NextResponse.json({ error: 'Unknown view.' }, { status: 400 });

  try {
    await prisma.applicationViewUsage.upsert({
      where: { userId_view: { userId: user.userId, view } },
      create: { userId: user.userId, dealerId: user.dealerId ?? null, view, count: 1 },
      update: { count: { increment: 1 }, dealerId: user.dealerId ?? null },
    });
  } catch {
    /* analytics is best-effort — don't surface errors to the dealer */
  }
  return NextResponse.json({ ok: true });
}
