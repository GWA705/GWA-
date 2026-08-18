// Consistent text casing for data posted to the portal, so entries look uniform
// no matter how someone typed them ("BAG FOR TREE" and "bag for tree" both
// become "Bag for Tree"). Two styles:
//   • toTitleCase  — names / titles / short labels
//   • toSentenceCase — descriptions and longer prose
// Both preserve known acronyms so "HD" never becomes "Hd".

// Acronyms that should always be uppercase, even mid-text.
const DOMAIN_ACRONYMS = new Set([
  'HD', 'GWA', 'PAP', 'UEI', 'HVAC', 'SOAP', 'ID', 'PEI', 'FAQ', 'PDF',
]);

// Personal names that read as all-caps initials (e.g. "JJ Francoeur"). Preserved
// in Title Case so "JJ" never becomes "Jj". Only applies to names/labels.
const NAME_INITIALS = new Set(['JJ']);

// Canadian province/territory codes. In a NAME we keep them uppercase when the
// person typed them uppercase (e.g. "Aerus NB"). We deliberately do NOT force
// these in free prose, so the ordinary word "on" is never turned into "ON".
const PROVINCE_CODES = new Set([
  'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT',
]);

// Small words that stay lowercase in Title Case (unless first/last word).
const MINOR_WORDS = new Set([
  'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'nor', 'of',
  'on', 'or', 'per', 'the', 'to', 'via', 'vs', 'with',
]);

function bareUpper(segment: string): string {
  return segment.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

/**
 * Title Case for names, titles and short labels. Capitalizes each significant
 * word, lowercases minor words in the middle, keeps domain acronyms uppercase,
 * and preserves province codes the user typed in caps.
 */
export function toTitleCase(input: string): string {
  const s = (input ?? '').replace(/\s+/g, ' ').trim();
  if (!s) return s;
  const words = s.split(' ');
  const last = words.length - 1;

  return words
    .map((word, i) =>
      word
        .split('-')
        .map((seg) => {
          if (!seg) return seg;
          const up = bareUpper(seg);
          if (DOMAIN_ACRONYMS.has(up)) return seg.toUpperCase();
          if (NAME_INITIALS.has(up)) return seg.toUpperCase();
          // Keep a province code the user intentionally typed in caps.
          if (PROVINCE_CODES.has(up) && seg === seg.toUpperCase()) return seg.toUpperCase();
          const lower = seg.toLowerCase();
          if (i !== 0 && i !== last && MINOR_WORDS.has(lower)) return lower;
          return lower.charAt(0).toUpperCase() + lower.slice(1);
        })
        .join('-'),
    )
    .join(' ');
}

/**
 * Sentence case for descriptions and longer text. Cleans up ALL-CAPS input
 * (lowercases it, then capitalizes each sentence); leaves normally-typed mixed
 * case alone apart from ensuring each sentence starts with a capital — so proper
 * nouns like "Home Depot" are not destroyed. Domain acronyms stay uppercase.
 * Line breaks are preserved.
 */
export function toSentenceCase(input: string): string {
  const s = (input ?? '').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();
  if (!s) return s;

  // Only fully re-case when the text is all-caps (no lowercase letters at all).
  const base = /[a-z]/.test(s) ? s : s.toLowerCase();

  // Capitalize the first letter at the very start, after sentence enders, and
  // after a line break.
  let out = base.replace(/(^|[.!?]\s+|\n\s*)([a-z])/g, (_m, pre: string, ch: string) => pre + ch.toUpperCase());

  // Restore domain acronyms (whole word, any case → uppercase).
  for (const a of DOMAIN_ACRONYMS) {
    out = out.replace(new RegExp(`\\b${a}\\b`, 'gi'), a);
  }
  return out;
}

/** Convenience: title-case a value, returning null for blank (for optional cols). */
export function titleOrNull(input: string | null | undefined): string | null {
  const v = toTitleCase((input ?? '').trim());
  return v || null;
}

/** Convenience: sentence-case a value, returning null for blank. */
export function sentenceOrNull(input: string | null | undefined): string | null {
  const v = toSentenceCase((input ?? '').trim());
  return v || null;
}
