import type { Prisma } from '@prisma/client';

/**
 * Build a case-insensitive search filter across the fields we let users search:
 * customer first/last name and the reference numbers (loan / finance / HD /
 * FinanceIt). Returns undefined for an empty query.
 */
export function searchWhere(q: string | undefined): Prisma.ApplicationWhereInput | undefined {
  const term = (q ?? '').trim();
  if (!term) return undefined;
  const contains = { contains: term, mode: 'insensitive' as const };
  return {
    OR: [
      { applicantFirstName: contains },
      { applicantLastName: contains },
      { financeReference: contains },
      { hdReference: contains },
      { financeItNumber: contains },
    ],
  };
}
