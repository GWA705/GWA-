import { prisma } from '@/lib/db';
import { nameTokens, DEALER_ALIASES } from './dealerSnapshot';

/**
 * Reusable office/dealer matcher for sales-journal rows — the same store-number,
 * name-token and alias logic the Dealer Snapshot uses, extracted so the journal
 * import and the office/store reports all attribute a row the SAME way. The
 * journal's own office/dealer column (the "location") wins; then the store-number
 * map as a fallback for rows whose label is blank or ambiguous.
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

  /**
   * Resolve a journal deal to a dealerId. The journal's own office/dealer column
   * (the "location") is the source of truth for WHO sold a deal — it stays correct
   * even when a store later changes hands between offices (e.g. a store that was
   * Platinum Air Care's and then became HSP's). So trust a confident office-label
   * match first, and fall back to the store-number map only when the label is blank
   * or ambiguous.
   */
  return function matchDeal(deal: { storeNumber?: string | null; location?: string | null }): string | null {
    const byLocation = matchByLocation(deal.location || '');
    if (byLocation) return byLocation;
    if (deal.storeNumber) {
      const byStore = storeToDealer.get(deal.storeNumber.trim());
      if (byStore) return byStore;
    }
    return null;
  };
}

/** A built matcher plus the dealer-id → name lookup the reports render with. */
export interface DealerMatchIndex {
  matchDeal: (deal: { storeNumber?: string | null; location?: string | null }) => string | null;
  nameById: Map<string, string>;
  /** Dealer ids that are archived (shown with an "(archived)" hint in pickers). */
  archived: Set<string>;
}

/**
 * Load EVERY dealer — active and archived — and build the shared matcher from
 * them. Archived dealers (e.g. an office that left the Home Depot program and
 * handed its stores to another office) must still attribute their historical
 * journal rows, so the reports that use this never filter on `active`. The
 * journal's Dealer column decides who a row belongs to, so a store that changed
 * hands splits correctly between the offices that sold there.
 */
export async function loadDealerMatchIndex(): Promise<DealerMatchIndex> {
  const dealers = await prisma.dealer.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, active: true, homeDepotStores: { select: { number: true } } },
  });
  return {
    matchDeal: buildDealerMatcher(dealers),
    nameById: new Map(dealers.map((d) => [d.id, d.name] as const)),
    archived: new Set(dealers.filter((d) => !d.active).map((d) => d.id)),
  };
}
