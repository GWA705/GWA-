import { Prisma, type GiftCardStatus } from '@prisma/client';
import { prisma } from './db';

// Page-size choices for the gift-card lists. 'all' shows everything matching the
// current filters (use with a month/search filter once volumes get large).
export const GIFT_CARD_PAGE_SIZES = [25, 50, 100] as const;
const DEFAULT_PER = 25;
const STATUSES = ['PENDING', 'SENT', 'CANCELLED'];

export interface GiftCardBrowseParams {
  dealerId?: string | null; // set → only this dealer's requests; null/undefined → all
  q?: string;
  status?: string;
  month?: string; // 'YYYY-MM'
  sort?: string; // 'newest' | 'oldest'
  perPage?: string; // a number or 'all'
  page?: string;
  includeNotes?: boolean;
}

/**
 * Filtered, sorted, paginated gift-card requests, plus the list of months that
 * have requests (for the month dropdown). Built to scale to hundreds a month.
 */
export async function queryGiftCards(p: GiftCardBrowseParams) {
  const status = STATUSES.includes(p.status ?? '') ? (p.status as GiftCardStatus) : '';
  const sort: 'newest' | 'oldest' = p.sort === 'oldest' ? 'oldest' : 'newest';
  const isAll = p.perPage === 'all';
  const perPage = isAll
    ? 0
    : (GIFT_CARD_PAGE_SIZES as readonly number[]).includes(Number(p.perPage))
      ? Number(p.perPage)
      : DEFAULT_PER;

  let createdAt: { gte: Date; lt: Date } | undefined;
  const mm = /^(\d{4})-(\d{2})$/.exec(p.month ?? '');
  const month = mm && Number(mm[2]) >= 1 && Number(mm[2]) <= 12 ? p.month! : '';
  if (month) {
    const y = Number(mm![1]);
    const m = Number(mm![2]);
    createdAt = {
      gte: new Date(Date.UTC(y, m - 1, 1)),
      lt: new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1)),
    };
  }

  const q = (p.q ?? '').trim();
  const where: Prisma.GiftCardRequestWhereInput = {
    ...(p.dealerId ? { dealerId: p.dealerId } : {}),
    ...(status ? { status } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(q
      ? {
          OR: [
            { customerName: { contains: q, mode: 'insensitive' } },
            { customerEmail: { contains: q, mode: 'insensitive' } },
            { customerPhone: { contains: q } },
            ...(!p.dealerId ? [{ dealer: { name: { contains: q, mode: 'insensitive' as const } } }] : []),
          ],
        }
      : {}),
  };

  const total = await prisma.giftCardRequest.count({ where });
  const pageCount = isAll ? 1 : Math.max(1, Math.ceil(total / perPage));
  const page = isAll ? 1 : Math.min(Math.max(1, Number(p.page) || 1), pageCount);

  const rows = await prisma.giftCardRequest.findMany({
    where,
    orderBy: { createdAt: sort === 'oldest' ? 'asc' : 'desc' },
    ...(isAll ? {} : { skip: (page - 1) * perPage, take: perPage }),
    include: {
      dealer: { select: { name: true } },
      ...(p.includeNotes
        ? { notes: { orderBy: { createdAt: 'asc' as const }, include: { author: { select: { name: true } } } } }
        : {}),
    },
  });

  const monthsRaw = p.dealerId
    ? await prisma.$queryRaw<{ ym: string }[]>(
        Prisma.sql`SELECT DISTINCT to_char("createdAt", 'YYYY-MM') AS ym FROM "GiftCardRequest" WHERE "dealerId" = ${p.dealerId} ORDER BY ym DESC`,
      )
    : await prisma.$queryRaw<{ ym: string }[]>(
        Prisma.sql`SELECT DISTINCT to_char("createdAt", 'YYYY-MM') AS ym FROM "GiftCardRequest" ORDER BY ym DESC`,
      );
  const months = monthsRaw.map((r) => r.ym);

  const firstShown = total === 0 ? 0 : isAll ? 1 : (page - 1) * perPage + 1;
  const lastShown = isAll ? total : Math.min(page * perPage, total);
  const perPageOut: number | 'all' = isAll ? 'all' : perPage;

  return { rows, total, page, pageCount, perPage: perPageOut, isAll, months, q, status, sort, month, firstShown, lastShown };
}

/** Human label for a 'YYYY-MM' key, e.g. 'Aug 2026'. */
export function monthLabel(ym: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!m) return ym;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1)).toLocaleDateString('en-CA', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
