import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/session';
import { isInternalRole } from '@/lib/constants';
import { rateLimit } from '@/lib/ratelimit';
import { extractCardsFromImage, type CardImageInput } from '@/lib/leadScanner';
import { getLeadCardTemplate } from '@/lib/leadCardTemplate';
import { recordAiUsage, AI_SERVICES } from '@/lib/aiUsage';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_FILE_BYTES = 12 * 1024 * 1024; // 12 MB per photo
const MAX_FILES = 6;
const OK_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/**
 * Read photographed Home Depot lead card(s) and return the extracted fields for
 * the dealer/staff to confirm. Each photo may contain one card OR several cards
 * laid out together — every distinct card comes back as its own entry, tagged
 * with the photo it came from. Assistive only — nothing is saved here; the client
 * saves each confirmed lead via the createScannedLeadAction server action.
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
  if (files.length > MAX_FILES) return NextResponse.json({ available: true, error: `Add at most ${MAX_FILES} photos at a time.` }, { status: 400 });

  const images: CardImageInput[] = [];
  for (const f of files) {
    if (f.size > MAX_FILE_BYTES) return NextResponse.json({ available: true, error: 'Each photo must be under 12 MB.' }, { status: 400 });
    const mime = OK_MIME.includes(f.type) ? f.type : 'image/jpeg';
    images.push({ buffer: Buffer.from(await f.arrayBuffer()), mime });
  }

  // Read each photo in parallel. Every photo can yield one OR several cards; we
  // flatten them all and tag each with the photo index it came from, so the
  // client can attach the right photo when saving each lead. The optional blank-
  // card reference (assets/lead-card/) is shown to the reader first as a layout
  // map; it's undefined when none is configured, so this is a no-op until then.
  const template = await getLeadCardTemplate();
  const perImage = await Promise.all(images.map((img) => extractCardsFromImage(img, { template })));

  // Meter real token usage per call so System health can show actual AI spend.
  // Best-effort — recordAiUsage never throws.
  for (const r of perImage) {
    if (r.usage) {
      void recordAiUsage({
        service: AI_SERVICES.cardScan,
        model: r.usage.model,
        inputTokens: r.usage.inputTokens,
        outputTokens: r.usage.outputTokens,
      });
    }
  }

  const off = perImage.find((r) => r.available === false);
  if (off) return NextResponse.json({ available: false, error: off.error });

  const cards: Array<Record<string, unknown> & { photoIndex: number }> = [];
  for (let i = 0; i < perImage.length; i++) {
    for (const c of perImage[i].cards ?? []) cards.push({ ...c, photoIndex: i });
  }

  if (cards.length === 0) {
    const firstErr = perImage.find((r) => r.error)?.error;
    return NextResponse.json({ available: true, cards: [], error: firstErr ?? 'No card details could be read — please type it in.' });
  }

  return NextResponse.json({ available: true, cards });
}
