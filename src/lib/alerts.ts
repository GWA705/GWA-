import type { Prisma, Role } from '@prisma/client';

// The audiences a pop-up alert can target.
export const ALERT_AUDIENCES = [
  { value: 'ALL_DEALERS', label: 'All dealers' },
  { value: 'DEALER', label: 'A specific dealer' },
  { value: 'REVIEWERS', label: 'Reviewers' },
  { value: 'ADMINS', label: 'Admins' },
  { value: 'STAFF', label: 'Reviewers & admins' },
  { value: 'EVERYONE', label: 'Everyone (dealers + staff)' },
] as const;

export type AlertAudience = (typeof ALERT_AUDIENCES)[number]['value'];

export function isAlertAudience(v: string): v is AlertAudience {
  return ALERT_AUDIENCES.some((a) => a.value === v);
}

export function audienceLabel(v: string): string {
  return ALERT_AUDIENCES.find((a) => a.value === v)?.label ?? v;
}

/**
 * Which active, still-unacknowledged alerts a given user should be shown, based
 * on their role (and dealer, for dealer-specific alerts).
 */
export function alertWhereForUser(
  role: Role,
  dealerId: string | null | undefined,
  userId: string,
): Prisma.DealerAlertWhereInput {
  const audiences: string[] = ['EVERYONE'];
  if (role === 'DEALER_USER') audiences.push('ALL_DEALERS');
  if (role === 'REVIEWER') audiences.push('REVIEWERS', 'STAFF');
  if (role === 'ADMIN') audiences.push('ADMINS', 'STAFF');

  const or: Prisma.DealerAlertWhereInput[] = [{ audience: { in: audiences } }];
  if (role === 'DEALER_USER' && dealerId) {
    or.push({ audience: 'DEALER', dealerId });
  }

  return {
    active: true,
    AND: [{ OR: or }, { acks: { none: { userId } } }],
  };
}
