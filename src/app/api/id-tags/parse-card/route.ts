import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { parseIdTagCard, cardIsReadable } from '@/lib/idTagCardParse';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Read valid-until / badge # / status off an uploaded Entuitive card so the
 * reviewer form can pre-fill them (Claude vision). Internal staff only. Returns
 * best-effort fields; the reviewer always confirms before saving.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session || (session.role !== 'REVIEWER' && session.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get('card');
  if (!file || typeof file !== 'object' || !('arrayBuffer' in file)) {
    return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
  }
  const f = file as File;
  if (f.size === 0 || f.size > 15 * 1024 * 1024) {
    return NextResponse.json({ error: 'File is empty or too large.' }, { status: 400 });
  }
  const mime = f.type || 'application/octet-stream';
  if (!cardIsReadable(mime)) {
    return NextResponse.json({ error: 'Unsupported file type — upload an image or PDF.' }, { status: 415 });
  }

  const parsed = await parseIdTagCard(Buffer.from(await f.arrayBuffer()), mime);
  if (!parsed) return NextResponse.json({ error: 'Could not read the card.' }, { status: 422 });
  return NextResponse.json(parsed);
}
