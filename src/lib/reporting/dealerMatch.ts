import { nameTokens, DEALER_ALIASES } from './dealerSnapshot';

/**
 * Reusable office/dealer matcher for sales-journal rows — the same store-number,
 * name-token and alias logic the Dealer Snapshot uses, extracted so the journal
 * import can attribute each archived row to a dealer.
 *
 * Precedence: an explicit ARCHIVED-dealer alias named in the location wins first
 * (a dealer that left the program but whose historical customers must stay with
 * it — its old Home Depot stores now belong to the active dealer who took them
 * over, so routing those rows by store number would wrongly hand them to the
 * new dealer); then store number; then an active alias; then an unambiguous
 * distinctive name-token match.
 */
export interface MatchableDealer {
  id: string;
  name: string;
  homeDepotStores: { number: string }[];
  /**
   * An archived dealer kept only so the journals still attribute its OWN rows to
   * it. Archived dealers match by explicit alias only — never by store number
   * (their stores were reassigned to an active dealer) or by loose name token.
   */
  archived?: boolean;
}

export function buildDealerMatcher(dealers: MatchableDealer[]) {
  const storeToDealer = new Map<string, string>();
  const tokenToDealer = new Map<string, string>();
  const ambiguousTokens = new Set<string>();
  const archivedIds = new Set(dealers.filter((d) => d.archived).map((d) => d.id));

  const registerToken = (tok: string, dealerId: string) => {
    const existing = tokenToDealer.get(tok);
    if (existing && existing !== dealerId) ambiguousTokens.add(tok);
    else tokenToDealer.set(tok, dealerId);
  };

  for (const d of dealers) {
    // Archived dealers contribute no store mapping and no loose name tokens — the
    // store(s) they used to work now belong to the active dealer who took them
    // over, and a stray token must not steal rows from a live dealer.
    if (d.archived) continue;
    for (const s of d.homeDepotStores) {
      const num = (s.number || '').trim();
      if (num) storeToDealer.set(num, d.id);
    }
    for (const tok of nameTokens(d.name)) registerToken(tok, d.id);
  }

  const aliasMatchers: { dealerId: string; tokens: string[]; archived: boolean }[] = [];
  for (const entry of DEALER_ALIASES) {
    const needle = entry.dealer.toLowerCase();
    const dealer = dealers.find((d) => d.name.toLowerCase().includes(needle));
    if (!dealer) continue;
    for (const alias of entry.aliases) {
      const toks = nameTokens(alias);
      if (toks.length) aliasMatchers.push({ dealerId: dealer.id, tokens: toks, archived: archivedIds.has(dealer.id) });
    }
  }
  aliasMatchers.sort((a, b) => b.tokens.length - a.tokens.length);
  const archivedAliasMatchers = aliasMatchers.filter((m) => m.archived);
  const activeAliasMatchers = aliasMatchers.filter((m) => !m.archived);

  // An archived dealer explicitly named in the location (e.g. "Platinum") keeps
  // its historical rows even though its old store now belongs to an active dealer.
  const matchArchivedAlias = (location: string): string | null => {
    const toks = nameTokens(location);
    if (toks.length === 0) return null;
    const tokSet = new Set(toks);
    for (const m of archivedAliasMatchers) {
      if (m.tokens.every((t) => tokSet.has(t))) return m.dealerId;
    }
    return null;
  };

  const matchByLocation = (location: string): string | null => {
    const toks = nameTokens(location);
    if (toks.length === 0) return null;
    const tokSet = new Set(toks);
    for (const m of activeAliasMatchers) {
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

  /**
   * Resolve a journal deal to a dealerId: an archived dealer explicitly named in
   * the location first, then store number, then the location (active aliases /
   * name tokens).
   */
  return function matchDeal(deal: { storeNumber?: string | null; location?: string | null }): string | null {
    const historical = matchArchivedAlias(deal.location || '');
    if (historical) return historical;
    if (deal.storeNumber) {
      const byStore = storeToDealer.get(deal.storeNumber.trim());
      if (byStore) return byStore;
    }
    return matchByLocation(deal.location || '');
  };
}
