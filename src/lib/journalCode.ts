/**
 * Auto journal code for a custom product: the first letter of each word,
 * uppercased (so "Pure and Clean" → "PAC", "City Soft" → "CS"). Punctuation is
 * stripped; digits are kept. Pure + dependency-free so both the client picker
 * and the server can use it.
 */
export function journalCodeFromName(name: string): string {
  return String(name ?? '')
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]/gi, ''))
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}
