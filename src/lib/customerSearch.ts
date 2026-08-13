import 'server-only';
import { prisma } from './db';
import { audit } from './audit';
import { rateLimit } from './ratelimit';
import { isGlobalSearchEnabled } from './settings';
import { STATUS_LABELS_SHORT } from './constants';
import type { SessionUser } from './session';
import { isInternal } from './rbac';

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

export type CustomerSearchResult =
  | { status: 'disabled' }
  | { status: 'too_short' }
  | { status: 'rate_limited'; retryAfterSec: number }
  | { status: 'internal'; matches: InternalMatch[] }
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

/** Application ids whose applicantPhone contains the given digit string. */
async function phoneMatchIds(phoneDigits: string, dealerId?: string): Promise<string[]> {
  if (phoneDigits.length < 7) return [];
  const rows = dealerId
    ? await prisma.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Application"
        WHERE "dealerId" = ${dealerId}
          AND regexp_replace("applicantPhone", '[^0-9]', '', 'g') LIKE ${'%' + phoneDigits + '%'}
        LIMIT 25`
    : await prisma.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Application"
        WHERE regexp_replace("applicantPhone", '[^0-9]', '', 'g') LIKE ${'%' + phoneDigits + '%'}
        LIMIT 50`;
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
    await audit({ actorId: user.userId, action: 'CUSTOMER_SEARCH', entityType: 'Application', detail: `internal q="${q}" hits=${apps.length}` });
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

  // 2) Cross-office matches — only on a FULL name (both first + last) or a FULL
  //    phone (≥10 digits), to limit fishing. Minimal routing info only.
  const fullPhone = isPhone && digits(q).length >= 10;
  const fullName = !isPhone && terms.length >= 2;
  let other: OtherOfficeMatch[] = [];
  if (fullPhone || fullName) {
    const otherApps = await prisma.application.findMany({
      where: fullPhone
        ? { id: { in: await phoneMatchIds(digits(q)) }, dealerId: { not: dealerId } }
        : { ...nameWhere(terms), dealerId: { not: dealerId } },
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
