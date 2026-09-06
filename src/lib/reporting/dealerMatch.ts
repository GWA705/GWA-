import { nameTokens, DEALER_ALIASES } from './dealerSnapshot';

/**
 * Reusable office/dealer matcher for sales-journal rows — the same store-number,
 * name-token and alias logic the Dealer Snapshot uses, extracted so the journal
 * import can attribute each archived row to a dealer. Store number wins; then an
 * explicit alias; then an unambiguous distinctive name-token match.
 */
export interface MatchableDealer {
  id: string;
  name: string;
  homeDepotStores: { number: string }[];
}

export function buildDealerMatcher(dealers: MatchableDealer[]) {
  const storeToDealer = new Map<string, string>();
  const tokenToDealer = new Map<string, string>();
  const ambiguousTokens = new Set<string>();

  const registerToken = (tok: string, dealerId: string) => {
    const existing = tokenToDealer.get(tok);
    if (existing && existing !== dealerId) ambiguousTokens.add(tok);
    else tokenToDealer.set(tok, dealerId);
  };

  for (const d of dealers) {
    for (const s of d.homeDepotStores) {
      const num = (s.number || '').trim();
      if (num) storeToDealer.set(num, d.id);
    }
    for (const tok of nameTokens(d.name)) registerToken(tok, d.id);
  }

  const aliasMatchers: { dealerId: string; tokens: string[] }[] = [];
  for (const entry of DEALER_ALIASES) {
    const needle = entry.dealer.toLowerCase();
    const dealer = dealers.find((d) => d.name.toLowerCase().includes(needle));
    if (!dealer) continue;
    for (const alias of entry.aliases) {
      const toks = nameTokens(alias);
      if (toks.length) aliasMatchers.push({ dealerId: dealer.id, tokens: toks });
    }
  }
  aliasMatchers.sort((a, b) => b.tokens.length - a.tokens.length);

  const matchByLocation = (location: string): string | null => {
    const toks = nameTokens(location);
    if (toks.length === 0) return null;
    const tokSet = new Set(toks);
    for (const m of aliasMatchers) {
      if (m.tokens.every((t) => tokSet.has(t))) return m.dealerId;
    }
    let hit: string | null = null;
    for (const tok of toks) {
      if (ambiguousTokens.has(tok)) continue;
      const dealerId = tokenToDealer.get(tok);
      if (!dealerId) continue;
      if (hit && hit !== dealerId) return null; // conflicting → give up
      hit = dealerId;
    }
    return hit;
  };

  /** Resolve a journal deal to a dealerId: store number first, then location. */
  return function matchDeal(deal: { storeNumber?: string | null; location?: string | null }): string | null {
    if (deal.storeNumber) {
      const byStore = storeToDealer.get(deal.storeNumber.trim());
      if (byStore) return byStore;
    }
    return matchByLocation(deal.location || '');
  };
}
