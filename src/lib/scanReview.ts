/**
 * New-application scan verification: which scanned sections must still be
 * confirmed before the deal can be submitted.
 *
 * A scan (driver's licence / filled credit app) can populate several sections at
 * once and flags each one it touched so the dealer double-checks it. But a scan
 * can flag a section the CURRENT entry method doesn't even show — e.g. a full
 * credit app carries employer info, yet the Express and Photo flows don't render
 * the employment or co-applicant sections. A hidden section has no checkbox to
 * tick and its scanned data isn't submitted anyway, so it must NEVER block the
 * deal (that stranded the submit with an invisible requirement — the bug this
 * guards against). Only a section that is currently on screen can block.
 */
export function sectionsBlockingSubmit(
  order: readonly string[],
  scanReview: ReadonlySet<string>,
  confirmed: ReadonlySet<string>,
  isVisible: (key: string) => boolean,
): string[] {
  return order.filter((k) => scanReview.has(k) && !confirmed.has(k) && isVisible(k));
}
