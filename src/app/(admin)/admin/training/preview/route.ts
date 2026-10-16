import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { requireAdminSection } from '@/lib/session';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

function baseUrl(): string {
  return (process.env.APP_URL || 'https://portal.ghsbarrie.ca').replace(/\/$/, '');
}

// Admin convenience: open the live trainee flow for an office exactly as a lead
// generator would see it — generating that office's training token on the fly if
// it doesn't have one yet. Redirects to the public /training/<token> page.
export async function GET(req: Request) {
  await requireAdminSection('training');
  const office = new URL(req.url).searchParams.get('office');
  if (!office) return NextResponse.redirect(`${baseUrl()}/admin/training`);

  let dealer = await prisma.dealer.findUnique({ where: { id: office }, select: { trainingToken: true, active: true } });
  if (!dealer || !dealer.active) return NextResponse.redirect(`${baseUrl()}/admin/training`);

  if (!dealer.trainingToken) {
    const token = randomBytes(24).toString('base64url');
    await prisma.dealer.update({ where: { id: office }, data: { trainingToken: token } });
    dealer = { ...dealer, trainingToken: token };
  }

  return NextResponse.redirect(`${baseUrl()}/training/${dealer.trainingToken}`);
}
