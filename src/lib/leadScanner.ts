/**
 * Georgian Water & Air — lead-card scanner (portable backend).
 *
 * A self-contained copy of the booking site's card reader, with every
 * app-specific dependency stripped out so it drops into the portal (or any
 * Node/Next.js server) unchanged. Give it one photo of a handwritten Home
 * Depot lead card — or several photos of the SAME card for accuracy — and it
 * returns the customer's details as structured JSON.
 *
 * What it does NOT do (on purpose — wire these to the portal's own systems):
 *   - No spend cap / budget guard. The booking app meters every call; add your
 *     own limit if bulk imports could loop over thousands of photos.
 *   - No feature flag. It runs whenever ANTHROPIC_API_KEY is set. Gate it in
 *     the portal if you want an in-app on/off switch.
 *   - No storage. The caller keeps the original photo; this only reads it.
 *
 * Dependencies: `zod` only. Calls the Anthropic REST API directly via `fetch`
 * (like lib/ai.ts) — no SDK dependency added to the portal.
 *
 * Environment:
 *   ANTHROPIC_API_KEY   (required) — your Anthropic API key.
 *   CARD_AI_MODEL       (optional) — defaults to 'claude-sonnet-5'.
 *
 * Privacy note: this is the one place customer data leaves your server (card
 * photos are sent to Anthropic's vision API). Make sure that's covered by your
 * data-processing agreement before it touches real customers.
 */

import { z } from 'zod';

// ── Image handling ───────────────────────────────────────────────────────────

type ImageMime = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
function toImageMime(mime: string): ImageMime {
  return (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mime) ? mime : 'image/jpeg') as ImageMime;
}

/** One photo: the raw bytes plus its mime type. */
export interface CardImageInput {
  buffer: Buffer;
  mime: string;
}

// ── Lenient parsing ──────────────────────────────────────────────────────────
//
// The model fills a forced tool call, but a vision model will now and then hand
// back a value slightly off the schema — "well" for the source, "yes" where a
// boolean is wanted, "Scale buildup" without the space, a confidence as a
// string. Under a strict schema one stray field failed the whole parse and threw
// away a perfectly good name, phone and address with it. So every field catches
// its own error and normalises what it can: a bad field falls back to
// null/unknown, the rest still comes through.

/** Map a messy string onto one of a known set by substring, else a fallback. */
function pick<T extends string>(val: unknown, table: [string, T][], fallback: T | null): T | null {
  if (typeof val !== 'string') return fallback;
  const k = val.trim().toLowerCase();
  if (!k) return fallback;
  for (const [needle, out] of table) if (k.includes(needle)) return out;
  return fallback;
}

/** Read a boolean written as a boolean, or as "yes"/"no"/"true"/"false". */
function toBool(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const k = v.trim().toLowerCase();
    if (['true', 'yes', 'y', '1', 'x', '✓'].includes(k)) return true;
    if (['false', 'no', 'n', '0'].includes(k)) return false;
  }
  return null;
}

const nullableStr = () => z.string().nullable().catch(null);
const looseBool = () => z.preprocess(toBool, z.boolean().nullable()).catch(null);

export const CardExtractionSchema = z.object({
  name: nullableStr(),
  phone: nullableStr(),
  occupation: nullableStr(),
  spouseName: nullableStr(),
  spousePhone: nullableStr(),
  spouseOccupation: nullableStr(),
  address: nullableStr(),
  city: nullableStr(),
  postalCode: nullableStr(),
  bestTimeToContact: nullableStr(),
  waterNotes: nullableStr(),
  hasWellWater: looseBool(),

  /** "Do you own your Home?" — the card's small print requires a homeowner. */
  ownsHome: z.preprocess(
    (v) => pick(v, [['parent', 'WITH_PARENTS'], ['own', 'OWN'], ['rent', 'RENT']], 'UNKNOWN'),
    z.enum(['OWN', 'RENT', 'WITH_PARENTS', 'UNKNOWN']),
  ).catch('UNKNOWN'),
  /** "Do you buy bottled water?" */
  buysBottledWater: looseBool(),
  /** "Do you use any water filters on your water now" */
  hasFilters: looseBool(),
  /** "What water source do you have?" */
  waterSource: z.preprocess(
    (v) => pick(v, [['well', 'Well'], ['city', 'City'], ['municip', 'City'], ['other', 'Other']], null),
    z.enum(['City', 'Well', 'Other']).nullable(),
  ).catch(null),
  /** "How would you rate your water quality?" */
  waterQuality: z.preprocess(
    (v) => pick(v, [['excellent', 'Excellent'], ['good', 'Good'], ['fair', 'Fair'], ['poor', 'Poor']], null),
    z.enum(['Excellent', 'Good', 'Fair', 'Poor']).nullable(),
  ).catch(null),
  /** "Please check any conditions you experience" — several may be ticked. */
  conditions: z.preprocess(
    (v) => (Array.isArray(v)
      ? v.map((x) => pick(x, [['taste', 'Taste'], ['odor', 'Odors'], ['smell', 'Odors'], ['scale', 'Scale build up'], ['stain', 'Stains']], null)).filter(Boolean)
      : []),
    z.array(z.enum(['Taste', 'Odors', 'Scale build up', 'Stains'])),
  ).catch([]),
  /** The "Store #" box, e.g. "7135". */
  storeNumber: nullableStr(),
  /** The date written on the card, as ISO yyyy-mm-dd if it can be read. */
  collectedOn: nullableStr(),
  /** Whoever's name is written on the card as having collected it. */
  generatorName: nullableStr(),
  /** 0-100, the model's own read on how legible the card was. */
  confidence: z.coerce.number().catch(50).transform((n) => (Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 50)),
  /** Field names the model was unsure about — flag these for the eye. */
  uncertainFields: z.preprocess(
    (v) => (Array.isArray(v) ? v.map(String) : []),
    z.array(z.string()),
  ).catch([]),
});

export type CardExtraction = z.infer<typeof CardExtractionSchema>;

export interface ExtractResult {
  /** false when the reader is switched off (no API key); true otherwise. */
  available: boolean;
  data?: CardExtraction;
  /** Raw tool JSON, handy to store alongside the lead for auditing. */
  raw?: string;
  error?: string;
  /** Token counts for your own metering, when the call reached the API. */
  usage?: { inputTokens: number; outputTokens: number; model: string };
}

// ── The prompt ───────────────────────────────────────────────────────────────
//
// This is where the accuracy lives. It is written for the exact Home Depot card
// GWA uses — the tick-box questionnaire, the spouse block, the store/date boxes.
// Tune it to your card, not the model: describe where things sit and how a tick
// is drawn, and tell it what a wrong answer costs. See README "Improving
// accuracy" before changing anything here.

const PROMPT = `You are reading a handwritten lead card collected by a Georgian Water & Air
representative at a Home Depot store in Ontario, Canada.

Extract the customer's details into the given schema. Rules:
- Handwriting is often messy. If a field is genuinely unreadable, return null for it
  rather than guessing — a blank field costs seconds to type, a wrong phone number
  costs a lead.
- Phone numbers are North American. Return digits only, no formatting.
- Cards have a second block for the spouse or partner — name, phone and occupation.
  Fill spouseName / spousePhone / spouseOccupation from it. Leave them null if the
  card has no spouse block or it was left blank; do not repeat the customer's own
  details into them.
- Occupation is often shorthand or a trade ("RN", "millwright", "retired"). Return
  it as written.
- Addresses are Ontario addresses. Postal codes look like L4M 4S5.
- "Best time to contact" is often shorthand: "eves", "aft 5", "wknds". Return it as
  written; do not expand or interpret it.
- Water notes are the customer's own words about their water (smell, taste, staining,
  hardness, well water). Keep their phrasing — it is the sales hook.
- List in uncertainFields the name of every field you are less than confident about.
- confidence is your overall read on how legible this card was, 0-100.
- If you see anything resembling a credit card number, DO NOT transcribe it. Leave the
  field null and note "card number present" in waterNotes.

The card also carries a short tick-box questionnaire. Read the ticks, not the labels:
- "Do you own your Home? Yes / No" -> ownsHome OWN or RENT. If they have written
  something like "with parents" use WITH_PARENTS. If no box is ticked use UNKNOWN.
  Do not infer this from anything else on the card — it decides whether the lead is
  callable at all, so a guess here is worse than an admission of not knowing.
- "Do you buy bottled water? Yes / No" -> buysBottledWater true or false, null if blank.
- "Do you use any water filters on your water now Yes / No" -> hasFilters, null if blank.
- "What water source do you have? City / Well / Other" -> waterSource. Words written
  beside "Other" belong in waterNotes, not in waterSource.
- "How would you rate your water quality? Excellent / Good / Fair / Poor" -> waterQuality.
- "Please check any conditions you experience: Taste / Odors / Scale build up / Stains"
  -> conditions, listing every one that is ticked. An empty list is fine.
- "Store #" -> storeNumber, digits as written.
- "Date" -> collectedOn as yyyy-mm-dd. Cards are written in the current or previous
  month; if the year is missing or ambiguous, return null rather than assuming.
- A person's name written on the card that is plainly not the customer — beside the
  water source, in a margin, or by a "collected by" line — is the lead generator.
  Put it in generatorName, never in name.

A tick can be a check, a cross, a scribble or a circle. If two boxes on one question
appear marked, or you cannot tell which is marked, return null for that question and
name it in uncertainFields. The office can read the photo in two seconds; a wrong
answer here is carried for the life of the lead.`;

/** The per-card fields, shared by the single-card and multi-card tools. */
const CARD_PROPS = {
  name: { type: ['string', 'null'] },
  phone: { type: ['string', 'null'] },
  occupation: { type: ['string', 'null'] },
  spouseName: { type: ['string', 'null'] },
  spousePhone: { type: ['string', 'null'] },
  spouseOccupation: { type: ['string', 'null'] },
  address: { type: ['string', 'null'] },
  city: { type: ['string', 'null'] },
  postalCode: { type: ['string', 'null'] },
  ownsHome: { type: 'string', enum: ['OWN', 'RENT', 'WITH_PARENTS', 'UNKNOWN'] },
  buysBottledWater: { type: ['boolean', 'null'] },
  hasFilters: { type: ['boolean', 'null'] },
  waterSource: { type: ['string', 'null'], enum: ['City', 'Well', 'Other', null] },
  waterQuality: { type: ['string', 'null'], enum: ['Excellent', 'Good', 'Fair', 'Poor', null] },
  conditions: { type: 'array', items: { type: 'string', enum: ['Taste', 'Odors', 'Scale build up', 'Stains'] } },
  storeNumber: { type: ['string', 'null'] },
  collectedOn: { type: ['string', 'null'] },
  generatorName: { type: ['string', 'null'] },
  bestTimeToContact: { type: ['string', 'null'] },
  waterNotes: { type: ['string', 'null'] },
  hasWellWater: { type: ['boolean', 'null'] },
  confidence: { type: 'number' },
  uncertainFields: { type: 'array', items: { type: 'string' } },
};

/** The forced tool the model fills. Mirrors CardExtractionSchema. */
const RECORD_CARD_TOOL = {
  name: 'record_card',
  description: 'Record the details read off the lead card.',
  input_schema: {
    type: 'object' as const,
    properties: CARD_PROPS,
    required: ['name', 'phone', 'confidence'],
  },
};

/** Multi-card tool: one entry per DISTINCT physical card found in the photo(s). */
const RECORD_CARDS_TOOL = {
  name: 'record_cards',
  description: 'Record every distinct lead card visible in the image(s), one entry per physical card.',
  input_schema: {
    type: 'object' as const,
    properties: {
      cards: {
        type: 'array',
        description: 'One object per separate physical lead card in the image(s).',
        items: { type: 'object', properties: CARD_PROPS, required: ['name', 'phone', 'confidence'] },
      },
    },
    required: ['cards'],
  },
};

const MULTI_CARD_NOTE = `IMPORTANT — this photo (or photos) may show ONE card or SEVERAL separate lead
cards laid out together (for example four cards side by side on a table). Treat
each PHYSICAL card as its own record and return one entry per card in "cards".
Read each card's fields only from that card — never mix a name from one card with
a phone from another. Order the entries top-to-bottom, left-to-right. If only one
card is present, return exactly one entry. Do not return blank entries for empty
space or the table.`;

export const CardsExtractionSchema = z.object({
  cards: z.array(CardExtractionSchema).catch([]),
});

export interface ExtractCardsResult {
  available: boolean;
  cards?: CardExtraction[];
  raw?: string;
  error?: string;
  usage?: { inputTokens: number; outputTokens: number; model: string };
}

/**
 * Read EVERY lead card visible in a single photo. Unlike extractCard (which treats
 * multiple photos as one card), this returns an array — one entry per distinct
 * physical card — so a photo of several cards laid out together becomes several
 * leads. Never throws: returns `{ available, error }` on any failure.
 */
export async function extractCardsFromImage(
  image: CardImageInput,
  opts: { template?: CardTemplate; model?: string } = {},
): Promise<ExtractCardsResult> {
  if (!image?.buffer?.length) return { available: true, error: 'No card image to read.' };
  if (!process.env.ANTHROPIC_API_KEY) {
    return { available: false, error: 'Card reading is not configured (no ANTHROPIC_API_KEY).' };
  }

  try {
    const promptText = opts.template?.notes?.trim()
      ? `${PROMPT}\n\n${MULTI_CARD_NOTE}\n\nNOTES ABOUT THIS CARD'S LAYOUT (from the office — trust these over your own read of where things sit):\n${opts.template.notes.trim()}`
      : `${PROMPT}\n\n${MULTI_CARD_NOTE}`;

    type Block =
      | { type: 'image'; source: { type: 'base64'; media_type: ImageMime; data: string } }
      | { type: 'text'; text: string };
    const content: Block[] = [];
    if (opts.template?.image) {
      content.push(
        { type: 'text', text: 'REFERENCE ONLY — the next image is a BLANK, unfilled copy of this card. Use it to learn where each field and tick-box sits. Do NOT read any customer values from it.' },
        { type: 'image', source: { type: 'base64', media_type: toImageMime(opts.template.image.mime), data: opts.template.image.buffer.toString('base64') } },
        { type: 'text', text: 'NOW READ THIS ONE — the following image is the FILLED photo, which may contain one or more cards.' },
      );
    }
    content.push({ type: 'image', source: { type: 'base64', media_type: toImageMime(image.mime), data: image.buffer.toString('base64') } });
    content.push({ type: 'text', text: promptText });

    const model = opts.model || process.env.CARD_AI_MODEL || 'claude-sonnet-5';
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY as string,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096, // several cards need more room than a single one
        tools: [RECORD_CARDS_TOOL],
        tool_choice: { type: 'tool', name: 'record_cards' },
        messages: [{ role: 'user', content }],
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('[leadScanner] API error (multi)', res.status, detail.slice(0, 300));
      return { available: true, error: 'Could not read the card automatically — please type it in.' };
    }
    const response = (await res.json()) as {
      content?: Array<{ type: string; input?: unknown }>;
      usage?: { input_tokens?: number; output_tokens?: number };
      model?: string;
    };
    const usage = {
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
      model: response.model ?? model,
    };
    const toolUse = (response.content ?? []).find((c) => c.type === 'tool_use');
    if (!toolUse) return { available: true, error: 'The card reader returned nothing usable.', usage };
    const parsed = CardsExtractionSchema.safeParse(toolUse.input);
    if (!parsed.success) {
      return { available: true, error: 'The card reader returned an unexpected shape.', raw: JSON.stringify(toolUse.input), usage };
    }
    // Drop entries with neither a name nor a phone (blank space read as a card).
    const cards = parsed.data.cards.filter((c) => (c.name && c.name.trim()) || (c.phone && c.phone.trim()));
    return { available: true, cards, raw: JSON.stringify(toolUse.input), usage };
  } catch (err) {
    console.error('[leadScanner] multi extraction failed', err);
    return { available: true, error: 'Could not read the card automatically — please type it in.' };
  }
}

/**
 * Optional blank-card reference. Pass a clean, EMPTY copy of your card and the
 * reader is shown it first as a labelled layout map ("this is where each field
 * sits") before the filled photo — this measurably helps on busy cards. `notes`
 * are your own hints about the layout, trusted over the model's own read.
 */
export interface CardTemplate {
  image?: CardImageInput;
  notes?: string;
}

/**
 * Read a lead card.
 *
 * @param input  One photo (Buffer) OR an array of photos of the SAME card. When
 *               several are given the reader cross-references them — a value it
 *               can read cleanly in one photo beats a guess from a blurry one.
 * @param opts   mimeType (only used with a single Buffer), an optional blank-card
 *               template, and an optional model override.
 *
 * Never throws: on any failure it returns `{ available, error }` so the caller
 * can fall back to a blank manual form instead of a dead end.
 */
export async function extractCard(
  input: Buffer | CardImageInput[],
  opts: { mimeType?: string; template?: CardTemplate; model?: string } = {},
): Promise<ExtractResult> {
  const images: CardImageInput[] = Buffer.isBuffer(input)
    ? [{ buffer: input, mime: opts.mimeType || 'image/jpeg' }]
    : input.filter((i) => i && i.buffer && i.buffer.length > 0);
  if (images.length === 0) return { available: true, error: 'No card image to read.' };

  if (!process.env.ANTHROPIC_API_KEY) {
    return { available: false, error: 'Card reading is not configured (no ANTHROPIC_API_KEY).' };
  }

  try {
    const promptText = opts.template?.notes?.trim()
      ? `${PROMPT}\n\nNOTES ABOUT THIS CARD'S LAYOUT (from the office — trust these over your own read of where things sit):\n${opts.template.notes.trim()}`
      : PROMPT;

    type Block =
      | { type: 'image'; source: { type: 'base64'; media_type: ImageMime; data: string } }
      | { type: 'text'; text: string };
    const content: Block[] = [];

    // Blank template first, as a labelled reference the model must not read from.
    if (opts.template?.image) {
      content.push(
        { type: 'text', text: 'REFERENCE ONLY — the next image is a BLANK, unfilled copy of this card. Use it to learn where each field and tick-box sits. Do NOT read any customer values from it; it is empty on purpose.' },
        { type: 'image', source: { type: 'base64', media_type: toImageMime(opts.template.image.mime), data: opts.template.image.buffer.toString('base64') } },
        { type: 'text', text: 'NOW READ THIS ONE — the following image(s) are the FILLED card. Read the customer’s handwritten details from them, using the blank above only as a map of the layout.' },
      );
    }

    // One filled photo, or several of the same card to cross-check.
    if (images.length === 1) {
      content.push({ type: 'image', source: { type: 'base64', media_type: toImageMime(images[0].mime), data: images[0].buffer.toString('base64') } });
    } else {
      content.push({ type: 'text', text: `The next ${images.length} images are DIFFERENT photos of the SAME lead card (a reshoot, the back, or a close-up). Read every field from whichever photo shows it most clearly, and cross-check the photos against each other — a value you can read cleanly in one photo beats a guess from a blurry one. Do not treat them as separate cards.` });
      for (const img of images) {
        content.push({ type: 'image', source: { type: 'base64', media_type: toImageMime(img.mime), data: img.buffer.toString('base64') } });
      }
    }
    content.push({ type: 'text', text: promptText });

    const model = opts.model || process.env.CARD_AI_MODEL || 'claude-sonnet-5';
    // Call the Anthropic REST API directly (the portal doesn't use the SDK — see
    // lib/ai.ts), so there's no extra dependency to install.
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY as string,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        tools: [RECORD_CARD_TOOL],
        tool_choice: { type: 'tool', name: 'record_card' },
        messages: [{ role: 'user', content }],
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('[leadScanner] API error', res.status, detail.slice(0, 300));
      return { available: true, error: 'Could not read the card automatically — please type it in.' };
    }

    const response = (await res.json()) as {
      content?: Array<{ type: string; input?: unknown }>;
      usage?: { input_tokens?: number; output_tokens?: number };
      model?: string;
    };
    const usage = {
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
      model: response.model ?? model,
    };

    const toolUse = (response.content ?? []).find((c) => c.type === 'tool_use');
    if (!toolUse) {
      return { available: true, error: 'The card reader returned nothing usable.', usage };
    }

    const parsed = CardExtractionSchema.safeParse(toolUse.input);
    if (!parsed.success) {
      return { available: true, error: 'The card reader returned an unexpected shape.', raw: JSON.stringify(toolUse.input), usage };
    }

    return { available: true, data: parsed.data, raw: JSON.stringify(toolUse.input), usage };
  } catch (err) {
    // Never block intake on the AI being down, rate-limited or misconfigured.
    console.error('[leadScanner] extraction failed', err);
    return { available: true, error: 'Could not read the card automatically — please type it in.' };
  }
}
