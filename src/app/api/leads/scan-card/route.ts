import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/session';
import { isInternalRole } from '@/lib/constants';
import { rateLimit } from '@/lib/ratelimit';
import { extractCard, type CardImageInput } from '@/lib/leadScanner';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_FILE_BYTES = 12 * 1024 * 1024; // 12 MB per photo
const MAX_FILES = 6;
const OK_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/**
 * Read a photographed Home Depot lead card and return the extracted fields for
 * the dealer/staff to confirm. Assistive only — nothing is saved here; the client
 * saves the confirmed lead via the createScannedLeadAction server action.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ available: true, error: 'Please sign in again.' }, { status: 401 });
  // Dealers (with an office) and GWA staff may scan.
  if (!isInternalRole(session.role) && !session.dealerId) {
    return NextResponse.json({ available: true, error: 'Your account can’t scan lead cards.' }, { status: 403 });
  }

  // Each scan is an AI vision call — cap per-user bursts (also protects spend).
  const rl = await rateLimit(`scan-lead:${session.userId}`, 20, 60);
  if (!rl.ok) return NextResponse.json({ available: true, error: 'Too many scans — wait a moment and try again.' }, { status: 429 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ available: true, error: 'Bad request.' }, { status: 400 });
  }

  const files = form.getAll('cardImage').filter((f): f is File => f instanceof File);
  if (files.length === 0) return NextResponse.json({ available: true, error: 'Choose a photo of the card first.' }, { status: 400 });
  if (files.length > MAX_FILES) return NextResponse.json({ available: true, error: `Add at most ${MAX_FILES} photos of the same card.` }, { status: 400 });

  const images: CardImageInput[] = [];
  for (const f of files) {
    if (f.size > MAX_FILE_BYTES) return NextResponse.json({ available: true, error: 'Each photo must be under 12 MB.' }, { status: 400 });
    const mime = OK_MIME.includes(f.type) ? f.type : 'image/jpeg';
    images.push({ buffer: Buffer.from(await f.arrayBuffer()), mime });
  }

  const result = await extractCard(images);
  return NextResponse.json(result);
}
