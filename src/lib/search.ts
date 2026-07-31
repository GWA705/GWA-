import type { Prisma } from '@prisma/client';

/**
 * Build a case-insensitive search filter across the fields we let users search:
 *  - customer first / last name (and full "First Last" when two words are given)
 *  - phone (mobile + home)
 *  - reference numbers: HD #, Financing deal #, loan #, finance #
 *  - city and postal code (street address stays encrypted and is NOT searchable)
 *
 * The same filter is used for the reviewer (all deals) and the dealer (scoped to
 * their own deals by the caller). Returns undefined for an empty query.
 */
export function searchWhere(q: string | undefined): Prisma.ApplicationWhereInput | undefined {
  const term = (q ?? '').trim();
  if (!term) return undefined;
  const contains = { contains: term, mode: 'insensitive' as const };

  const or: Prisma.ApplicationWhereInput[] = [
    { applicantFirstName: contains },
    { applicantLastName: contains },
    { applicantPhone: contains },
    { hdReference: contains },
    { financeItNumber: contains },
    { loanReference: contains },
    { financeReference: contains },
    { loanApplication: { is: { city: contains } } },
    { loanApplication: { is: { postalCode: contains } } },
    { loanApplication: { is: { homePhone: contains } } },
  ];

  // "First Last" (either order) — so a full name matches even though the names
  // live in separate columns.
  const words = term.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const a = { contains: words[0], mode: 'insensitive' as const };
    const b = { contains: words[1], mode: 'insensitive' as const };
    or.push({ AND: [{ applicantFirstName: a }, { applicantLastName: b }] });
    or.push({ AND: [{ applicantFirstName: b }, { applicantLastName: a }] });
  }

  return { OR: or };
}
