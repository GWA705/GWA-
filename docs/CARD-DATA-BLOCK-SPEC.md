# Credit-card-data upload block — build spec

Status: **BUILT (hard-block) 2026-08-09.** Live in `lib/cardscan.ts`, wired into
document uploads (`lib/upload.ts`, block-before-store with text-layer + inline
OCR) and note text (dealer + staff). Blocks log a `CARD_DATA_BLOCKED` audit
event with signals only (never the digits). Mail-body scanning + an admin
"blocked uploads" view remain as future enhancements.

## Why
The portal is built on the premise that **no credit card data is ever collected**
— that's what keeps PCI-DSS out of scope. This feature actively stops card data
(numbers, expiry, CVV, brand names) from being uploaded, so it can't accidentally
enter the system and pull it into PCI scope. Strong deterrent, not a 100%
guarantee — the "don't collect card data" policy still stands.

## Core principle: block BEFORE storing
Detection runs during upload/submit. If card data is found, the file/text is
**rejected and never persisted** (and never written to logs). "Quarantine for
review" is deliberately NOT used — storing it would defeat the purpose.

## Detection signals
- **PAN (card number):** a run of 13–19 digits (allowing spaces/dashes) that
  BOTH (a) passes the **Luhn checksum** and (b) matches a known card prefix:
  - Visa `4`; Mastercard `51–55` and `2221–2720`; Amex `34/37` (15 digits);
    Discover `6011`, `65`, `644–649`; Diners `36/38/300–305`; JCB `35`.
  - Luhn + prefix = high precision; avoids SIN (9 digits), HD customer #s, loan
    numbers, phone numbers, and void-cheque routing/account numbers.
- **Brand words:** VISA, MASTERCARD / MC, AMERICAN EXPRESS / AMEX, DISCOVER.
  Corroborating only ("visa" also = immigration) — strong when near a PAN.
- **Expiry:** `MM/YY` or `MM/YYYY` near a detected number.
- **CVV/CVC:** 3–4 digits ONLY when adjacent to a "CVV/CVC/security code" label
  or a PAN. Never flagged on its own.

Confidence model: a Luhn-valid PAN with a known prefix is enough to block. Brand
word + expiry + CVV nearby raise confidence and can be logged as the reason.

## Where it runs
1. **Document uploads (primary)** — in `lib/upload.ts`, after convert-to-PDF and
   before `putDocument`/`document.create`:
   - Pull the **text layer** (unpdf) — instant.
   - For scans/photos (no text layer), run a **fast inline OCR pass** (reuse
     `lib/ocr`) purely for card detection.
   - If card data is found → return an error, do **not** store the file.
   - Applies to all stages: application docs, funding package, reviewer uploads.
2. **Typed fields / notes / mail** — scan text server-side on submit (application
   fields, deal notes, mail body). Block with a message if a PAN is present.

## What the user sees
Clear, non-scary message, e.g.:
> "For your customer's security, please remove credit card details before
> uploading — we never need a card number, expiry, or CVV. Cover them and try
> again."

## Audit / admin
- Write a `CARD_DATA_BLOCKED` audit event with the **fact only** — surface
  (upload/notes/mail), which signals hit (e.g. "PAN+Visa+expiry"), who, when.
  **Never** store or log the matched digits.
- Optional later: a small admin "blocked uploads" view + adjustable sensitivity.

## Implementation sketch
- `lib/cardscan.ts` (pure, unit-testable):
  - `findCardData(text): { pan: boolean; brands: string[]; expiry: boolean; cvvContext: boolean; score }`
  - Luhn helper + brand-prefix table + context regexes. No raw numbers returned.
- Wire into `lib/upload.ts` (block before store) and the text-accepting server
  actions (application submit, notes, mail).
- Tests: known valid test PANs (e.g. 4111 1111 1111 1111) flagged; SIN, phone,
  HD #, loan #, routing/account numbers NOT flagged; Luhn edge cases.

## Limitations (be honest)
- A heavily obscured/blurry card photo can slip past OCR — reduces risk, doesn't
  eliminate it.
- Inline OCR on image uploads adds a few seconds (the cost of blocking before
  storing). Text PDFs and typed fields are instant.
- Tuned for **high precision** (few false blocks) to start; adjust from real use.

## Phases
1. Text fields + text-layer documents (instant PAN + keyword detection).
2. Scans & photos (inline OCR card-scan at upload).
3. Tuning + admin visibility (blocked-uploads log, sensitivity control).

## Open decision
- **Hard-block vs. warn-and-confirm.** Recommendation: **hard-block** for card
  data (reject, never store). Warn-and-confirm would risk storing it.
