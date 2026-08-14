import 'server-only';
import { prisma } from './db';
import { audit } from './audit';
import { rateLimit } from './ratelimit';
import { isGlobalSearchEnabled } from './settings';
import { STATUS_LABELS_SHORT, hdOriginLabel } from './constants';
import type { SessionUser } from './session';
import { isInternal, isSuperAdmin, canAdminSection } from './rbac';
import { readJournal, sheetIdFor, EARLIEST_JOURNAL_YEAR } from './reporting/journalRead';
import { nameTokens, DEALER_ALIASES } from './reporting/dealerSnapshot';

interface DealerContact { name: string; phone: string }

/**
 * Map a journal deal to its dealer (name + contact phone from the dealer
 * profile). HD deals attach by store number; outside-HD by the same location
 * aliases the Dealer Snapshot uses. Phone is blank until the office fills in
 * their profile.
 */
async function buildDealerContactLookup(): Promise<(storeNumber: string | null, location: string) => DealerContact | null> {
  const dealers = await prisma.dealer.findMany({
    where: { active: true },
    select: { id: true, name: true, homeDepotStores: { select: { number: true } }, profile: { select: { phone: true, supportPhone: true } } },
  });
  const info = new Map<string, DealerContact>();
  const byStore = new Map<string, string>(); // store number → dealerId
  const byToken = new Map<string, string>(); // name token → dealerId
  const ambiguous = new Set<string>();
  const register = (tok: string, id: string) => {
    const ex = byToken.get(tok);
    if (ex && ex !== id) ambiguous.add(tok);
    else byToken.set(tok, id);
  };
  for (const d of dealers) {
    info.set(d.id, { name: d.name, phone: (d.profile?.phone || d.profile?.supportPhone || '').trim() });
    for (const s of d.homeDepotStores) { const n = s.number.trim(); if (n) byStore.set(n, d.id); }
    for (const tok of nameTokens(d.name)) register(tok, d.id);
  }
  // Authoritative city/name aliases (Barrie → Georgian, etc.), whole-phrase.
  const aliasMatchers: { dealerId: string; tokens: string[] }[] = [];
  for (const entry of DEALER_ALIASES) {
    const dealer = dealers.find((d) => d.name.toLowerCase().includes(entry.dealer.toLowerCase()));
    if (!dealer) continue;
    for (const alias of entry.aliases) {
      const toks = nameTokens(alias);
      if (toks.length) aliasMatchers.push({ dealerId: dealer.id, tokens: toks });
    }
  }
  aliasMatchers.sort((a, b) => b.tokens.length - a.tokens.length);

  const store4 = (raw: string | null): string => (raw ? (raw.match(/\d{3,}/)?.[0] ?? '') : '');
  return (storeNumber, location) => {
    let id: string | null = null;
    const sn = store4(storeNumber);
    if (sn && byStore.has(sn)) id = byStore.get(sn)!;
    if (!id) {
      const toks = nameTokens(location);
      const set = new Set(toks);
      for (const m of aliasMatchers) if (m.tokens.every((t) => set.has(t))) { id = m.dealerId; break; }
      if (!id) {
        let hit: string | null = null;
        for (const tok of toks) {
          if (ambiguous.has(tok)) continue;
          const d = byToken.get(tok);
          if (!d) continue;
          if (hit && hit !== d) { hit = null; break; }
          hit = d;
        }
        id = hit;
      }
    }
    return id ? info.get(id) ?? null : null;
  };
}

/**
 * Full detailed search grant. Granted to:
 *  - super admins (implicitly);
 *  - any admin holding the 'customer-search' back-end section (the switch a
 *    Super Admin flips on the Admin → Admin access screen — this is how you give
 *    someone a restricted login that can search customers and nothing else);
 *  - any internal user with the per-user canSearchCustomers flag (reviewers).
 */
export async function canSearchAllCustomers(user: SessionUser): Promise<boolean> {
  if (!isInternal(user)) return false;
  if (isSuperAdmin(user)) return true;
  if (canAdminSection(user, 'customer-search')) return true;
  const me = await prisma.user.findUnique({ where: { id: user.userId }, select: { canSearchCustomers: true } });
  return !!me?.canSearchCustomers;
}

/**
 * Global customer search.
 *
 * Two tiers, gated behind an admin master toggle (isGlobalSearchEnabled):
 *  - Internal staff (reviewer/admin): full search across all customers, linking
 *    to the deal — they already have access to every deal.
 *  - Dealers: their OWN customers link to the deal (full access). A customer at
 *    ANOTHER office returns only routing info — the customer's name, the office,
 *    the office contact + phone + location — never address/email/SIN/deal data.
 *
 * Every search is rate-limited and audit-logged (who searched what, how many
 * hits) so cross-office lookups are throttled and traceable.
 */

const MIN_QUERY = 3;

export interface InternalMatch {
  applicationId: string;
  name: string;
  dealerName: string;
  province: string;
  statusLabel: string;
  reference: string;
}

export interface OwnMatch {
  applicationId: string;
  name: string;
  province: string;
  statusLabel: string;
}

export interface OtherOfficeMatch {
  name: string;
  officeName: string;
  officeContact: string | null;
  officePhone: string | null;
  officeLocation: string | null;
}

export interface JournalMatch {
  name: string;
  phone: string;
  address: string;
  hdRef: string;
  hdOrigin: string | null; // "Home Depot lead" / "GWA-created"
  store: string;
  product: string;
  result: string; // OK / PE/OK / RB
  saleDate: string;
  datePaid: string;
  amount: string;
  finance: string; // how it was paid / finance company bucket
  source: string; // HD Program / Outside-HD bucket
  year: number;
  link: string;
  dealerName: string; // the office this deal belongs to (by store / location)
  dealerPhone: string; // their contact number — blank until they fill their profile
}

export type CustomerSearchResult =
  | { status: 'disabled' }
  | { status: 'not_granted' }
  | { status: 'too_short' }
  | { status: 'rate_limited'; retryAfterSec: number }
  | { status: 'internal'; matches: InternalMatch[]; journalMatches: JournalMatch[] }
  | { status: 'dealer'; own: OwnMatch[]; other: OtherOfficeMatch[] };

function digits(s: string): string {
  return s.replace(/\D/g, '');
}
function looksLikePhone(q: string): boolean {
  return digits(q).length >= 7;
}
function nameTerms(q: string): string[] {
  return q.trim().split(/\s+/).filter((t) => t.length >= 2);
}

// --- low-level matchers ----------------------------------------------------

/**
 * Application ids matching a phone. `exact` compares the full normalized number
 * (used for the dealer cross-office reveal, which requires the exact number);
 * otherwise it's a substring match (own-office / internal convenience).
 */
async function phoneMatchIds(phoneDigits: string, dealerId?: string, exact = false): Promise<string[]> {
  if (phoneDigits.length < (exact ? 10 : 7)) return [];
  const norm = `regexp_replace("applicantPhone", '[^0-9]', '', 'g')`;
  // Match on the last 10 digits when exact, tolerating a leading country code.
  const cmp = exact ? phoneDigits.slice(-10) : phoneDigits;
  const rows = dealerId
    ? exact
      ? await prisma.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Application" WHERE "dealerId" = ${dealerId} AND right(regexp_replace("applicantPhone", '[^0-9]', '', 'g'), 10) = ${cmp} LIMIT 25`
      : await prisma.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Application" WHERE "dealerId" = ${dealerId} AND regexp_replace("applicantPhone", '[^0-9]', '', 'g') LIKE ${'%' + cmp + '%'} LIMIT 25`
    : exact
      ? await prisma.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Application" WHERE right(regexp_replace("applicantPhone", '[^0-9]', '', 'g'), 10) = ${cmp} LIMIT 50`
      : await prisma.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Application" WHERE regexp_replace("applicantPhone", '[^0-9]', '', 'g') LIKE ${'%' + cmp + '%'} LIMIT 50`;
  return rows.map((r) => r.id);
}

function nameWhere(terms: string[]) {
  // Every term must appear in the first or last name.
  return {
    AND: terms.map((t) => ({
      OR: [
        { applicantFirstName: { contains: t, mode: 'insensitive' as const } },
        { applicantLastName: { contains: t, mode: 'insensitive' as const } },
      ],
    })),
  };
}

/**
 * Search the Google Sheets sales journals (all configured years) by name, phone,
 * HD reference (800…/701…), or address. Reads are cached; for granted staff only.
 */
async function searchJournalDeals(query: string): Promise<JournalMatch[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const qNorm = q.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const qDigits = digits(q);
  const terms = qNorm.split(' ').filter((t) => t.length >= 2);

  // Which years to search: every configured journal from next year back to the
  // oldest book we keep (2024). Only years with an id set are read, so this is
  // naturally bounded; reads are cached, so repeat keystrokes are cheap.
  const now = new Date().getFullYear();
  const years: number[] = [];
  for (let y = now + 1; y >= EARLIEST_JOURNAL_YEAR; y -= 1) {
    if (sheetIdFor(y)) years.push(y);
  }
  const [reads, dealerFor] = await Promise.all([
    Promise.all(years.map((y) => readJournal(y))),
    buildDealerContactLookup(),
  ]);
  const deals = reads.flatMap((r) => r.deals);

  const matches: (JournalMatch & { sort: number })[] = [];
  for (const d of deals) {
    const hay = `${d.firstName} ${d.lastName} ${d.address} ${d.hdRef} ${d.hdStore} ${d.location}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ');
    const phoneDigits = d.phone.replace(/\D/g, '');
    const hdDigits = d.hdRef.replace(/\D/g, '');
    const digitHit = qDigits.length >= 4 && (phoneDigits.includes(qDigits) || hdDigits.includes(qDigits));
    const termHit = terms.length > 0 && terms.every((t) => hay.includes(t));
    if (!digitHit && !termHit) continue;
    const fmtDate = (dt: Date | null) =>
      dt ? dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    const dealer = dealerFor(d.storeNumber, d.location);
    matches.push({
      name: `${d.firstName} ${d.lastName}`.trim() || '(no name)',
      phone: d.phone,
      address: d.address,
      hdRef: d.hdRef,
      hdOrigin: hdOriginLabel(d.hdRef),
      store: d.hdStore || d.storeNumber || '',
      product: d.product,
      result: d.result,
      saleDate: fmtDate(d.date),
      datePaid: fmtDate(d.datePaid),
      amount: d.gross > 0 ? `$${Math.round(d.gross).toLocaleString('en-US')}` : '',
      finance: d.financeBucket && d.financeBucket !== 'Unknown' ? d.financeBucket : '',
      source: d.sourceCategory || '',
      year: d.year,
      link: d.linkUrl,
      dealerName: dealer?.name ?? '',
      dealerPhone: dealer?.phone ?? '',
      sort: (d.date?.getTime() ?? 0),
    });
    // No early break — we collect matches across EVERY year first, then rank by
    // date, so older-year deals aren't cut off by a cap hit in a recent year.
  }
  return matches
    .sort((a, b) => b.sort - a.sort)
    .slice(0, 50)
    .map(({ sort, ...m }) => m);
}

function officeLocation(profile: { address: string | null } | null): string | null {
  if (!profile?.address) return null;
  // Show a coarse location (city/prov line) — the last non-empty comma-part or line.
  const parts = profile.address.split(/[,\n]/).map((p) => p.trim()).filter(Boolean);
  return parts.length ? parts.slice(-2).join(', ') : null;
}

// --- public API ------------------------------------------------------------

export async function searchCustomers(user: SessionUser, rawQuery: string): Promise<CustomerSearchResult> {
  if (!(await isGlobalSearchEnabled())) return { status: 'disabled' };
  const q = rawQuery.trim();
  if (q.length < MIN_QUERY) return { status: 'too_short' };

  const rl = await rateLimit(`custsearch:${user.userId}`, 30, 60);
  if (!rl.ok) return { status: 'rate_limited', retryAfterSec: rl.retryAfterSec };

  const isPhone = looksLikePhone(q);
  const terms = nameTerms(q);

  if (isInternal(user)) {
    if (!(await canSearchAllCustomers(user))) return { status: 'not_granted' };
    const ids = isPhone ? await phoneMatchIds(digits(q)) : [];
    const apps = await prisma.application.findMany({
      where: isPhone ? { id: { in: ids } } : nameWhere(terms),
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: {
        id: true,
        applicantFirstName: true,
        applicantLastName: true,
        province: true,
        status: true,
        hdReference: true,
        financeItNumber: true,
        dealer: { select: { name: true } },
      },
    });
    // Also sweep the Google Sheets sales journals (portal deals only go back so
    // far; the journals hold the full history including HD 800/701 references).
    const journalMatches = await searchJournalDeals(q);
    await audit({ actorId: user.userId, action: 'CUSTOMER_SEARCH', entityType: 'Application', detail: `internal q="${q}" hits=${apps.length} journal=${journalMatches.length}` });
    return {
      status: 'internal',
      matches: apps.map((a) => ({
        applicationId: a.id,
        name: `${a.applicantFirstName} ${a.applicantLastName}`.trim(),
        dealerName: a.dealer?.name ?? '—',
        province: a.province,
        statusLabel: STATUS_LABELS_SHORT[a.status],
        reference: a.hdReference || a.financeItNumber || '',
      })),
      journalMatches,
    };
  }

  // Dealer lookup.
  const dealerId = user.dealerId ?? '__none__';

  // 1) Own-office matches (full access).
  const ownApps = await prisma.application.findMany({
    where: isPhone ? { id: { in: await phoneMatchIds(digits(q), dealerId) } } : { ...nameWhere(terms), dealerId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { id: true, applicantFirstName: true, applicantLastName: true, province: true, status: true },
  });
  const own: OwnMatch[] = ownApps.map((a) => ({
    applicationId: a.id,
    name: `${a.applicantFirstName} ${a.applicantLastName}`.trim(),
    province: a.province,
    statusLabel: STATUS_LABELS_SHORT[a.status],
  }));

  // 2) Cross-office matches — only on the EXACT full phone number (≥10 digits).
  //    A name search never reveals another office (limits fishing to someone who
  //    already has the customer's number). Minimal routing info only.
  const exactPhone = isPhone && digits(q).length >= 10;
  let other: OtherOfficeMatch[] = [];
  if (exactPhone) {
    const otherApps = await prisma.application.findMany({
      where: { id: { in: await phoneMatchIds(digits(q), undefined, true) }, dealerId: { not: dealerId } },
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: {
        applicantFirstName: true,
        applicantLastName: true,
        dealer: {
          select: {
            name: true,
            profile: { select: { businessName: true, phone: true, supportPhone: true, supportContactName: true, billingContactName: true, address: true } },
          },
        },
      },
    });
    // Dedupe to one row per (customer, office).
    const seen = new Set<string>();
    for (const a of otherApps) {
      const name = `${a.applicantFirstName} ${a.applicantLastName}`.trim();
      const officeName = a.dealer?.profile?.businessName || a.dealer?.name || 'Another office';
      const key = `${name.toLowerCase()}|${officeName.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const p = a.dealer?.profile ?? null;
      other.push({
        name,
        officeName,
        officeContact: p?.supportContactName || p?.billingContactName || null,
        officePhone: p?.phone || p?.supportPhone || null,
        officeLocation: officeLocation(p),
      });
    }
  }

  await audit({
    actorId: user.userId,
    action: 'CUSTOMER_SEARCH',
    entityType: 'Application',
    detail: `dealer q="${q}" own=${own.length} other=${other.length}`,
  });

  return { status: 'dealer', own, other };
}
