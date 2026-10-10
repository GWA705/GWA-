import 'server-only';
import { prisma } from '@/lib/db';

/**
 * Portal usage analytics, built entirely from the immutable audit log — what
 * people DO across the portal. Admin-only (see /admin/usage). No new tracking:
 * every meaningful action is already written to AuditLog.
 *
 * All time bucketing is done in the office timezone (America/Toronto) so
 * "busiest day / hour" reflects when the team actually works.
 */

const TZ = 'America/Toronto';
const DAY_MS = 24 * 60 * 60 * 1000;

// Actions that are authentication noise, not "features" — counted separately.
const AUTH_ACTIONS = ['LOGIN_SUCCESS', 'LOGOUT', 'LOGIN_FAILED', 'PASSWORD_CHANGE', 'PASSWORD_RESET', 'PASSWORD_RESET_REQUEST', 'MFA_ENROLLED'];

// Friendly names for the actions people see. Anything not listed is prettified
// from its SNAKE_CASE code so a new action still reads sensibly.
const ACTION_LABELS: Record<string, string> = {
  STATUS_CHANGE: 'Deal status changes',
  CUSTOMER_SEARCH: 'Customer searches',
  DOC_DOWNLOAD: 'Documents downloaded',
  DOC_UPLOAD: 'Documents uploaded',
  DOCUMENT_DELETE: 'Documents deleted',
  MARKETPLACE_FILE_DOWNLOAD: 'Marketplace downloads',
  MAIL_SEND: 'Mail sent',
  MAIL_REPLY: 'Mail replies',
  MAIL_ACK: 'Mail acknowledged',
  MAIL_ATTACH_VIEW: 'Mail attachments viewed',
  APPLICATION_CREATE: 'Deals created',
  APPLICATION_SUBMIT: 'Deals submitted',
  APPLICATION_UPDATE: 'Deals edited',
  ORDER_SUBMIT: 'Orders submitted',
  DECISION: 'Approve / decline decisions',
  FUNDING_SUBMIT: 'Funding submitted',
  FUNDING_DECISION: 'Funding decisions',
  JOURNAL_WRITE: 'Journal writes',
  JOURNAL_ARCHIVE_IMPORT: 'Journal imports',
  PII_DECRYPT: 'Identity reveals',
  DATA_EXPORT: 'Data exports',
  DEALER_UPDATE: 'Dealer edits',
  DEALER_CREATE: 'Dealers created',
  USER_UPDATE: 'User edits',
  USER_CREATE: 'Users created',
  USER_REQUEST: 'Login requests',
  USER_REQUEST_DECISION: 'Login-request decisions',
  CONTENT_UPDATE: 'Content edits',
  CONTENT_CREATE: 'Content created',
  SETTING_UPDATE: 'Settings changed',
};

export function labelForAction(action: string): string {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  const s = action.replace(/_/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export interface LabeledCount { key: string; label: string; count: number }
export interface OfficeCount { office: string; count: number }
export interface PersonCount { userId: string; name: string; office: string | null; count: number }
export interface DayCount { date: string; count: number }
export interface HourCount { hour: number; count: number }

export interface PortalUsage {
  days: number;
  totals: { activeUsers: number; totalActions: number; logins: number };
  busiest: { day: string | null; hour: number | null };
  topFeatures: LabeledCount[];
  byOffice: OfficeCount[];
  byPerson: PersonCount[];
  daily: DayCount[];
  byHour: HourCount[];
}

function fromDate(days: number): Date {
  return new Date(Date.now() - days * DAY_MS);
}

export async function getPortalUsage(days = 30): Promise<PortalUsage> {
  const from = fromDate(days);
  const authList = AUTH_ACTIONS;

  const [totalsRows, features, offices, people, daily, hours, busyDay] = await Promise.all([
    prisma.$queryRaw<{ total: number; users: number; logins: number }[]>`
      SELECT count(*)::int AS total,
             count(DISTINCT "actorId")::int AS users,
             count(*) FILTER (WHERE action = 'LOGIN_SUCCESS')::int AS logins
      FROM "AuditLog" WHERE "createdAt" >= ${from}`,
    prisma.$queryRaw<{ action: string; n: number }[]>`
      SELECT action, count(*)::int AS n FROM "AuditLog"
      WHERE "createdAt" >= ${from} AND action != ALL(${authList}::text[])
      GROUP BY action ORDER BY n DESC LIMIT 12`,
    prisma.$queryRaw<{ office: string | null; n: number }[]>`
      SELECT d.name AS office, count(*)::int AS n
      FROM "AuditLog" a
      LEFT JOIN "User" u ON u.id = a."actorId"
      LEFT JOIN "Dealer" d ON d.id = u."dealerId"
      WHERE a."createdAt" >= ${from}
      GROUP BY d.name ORDER BY n DESC LIMIT 10`,
    prisma.$queryRaw<{ userId: string; name: string; office: string | null; n: number }[]>`
      SELECT a."actorId" AS "userId",
             COALESCE(u.name, a."actorName", a."actorEmail", 'Unknown') AS name,
             d.name AS office,
             count(*)::int AS n
      FROM "AuditLog" a
      LEFT JOIN "User" u ON u.id = a."actorId"
      LEFT JOIN "Dealer" d ON d.id = u."dealerId"
      WHERE a."createdAt" >= ${from} AND a."actorId" IS NOT NULL
      GROUP BY a."actorId", u.name, a."actorName", a."actorEmail", d.name
      ORDER BY n DESC LIMIT 12`,
    prisma.$queryRaw<{ date: string; n: number }[]>`
      SELECT to_char(date_trunc('day', a."createdAt" AT TIME ZONE ${TZ}), 'YYYY-MM-DD') AS date,
             count(*)::int AS n
      FROM "AuditLog" a WHERE a."createdAt" >= ${from}
      GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<{ hour: number; n: number }[]>`
      SELECT extract(hour FROM a."createdAt" AT TIME ZONE ${TZ})::int AS hour,
             count(*)::int AS n
      FROM "AuditLog" a WHERE a."createdAt" >= ${from}
      GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<{ dow: string; n: number }[]>`
      SELECT trim(to_char(a."createdAt" AT TIME ZONE ${TZ}, 'Dy')) AS dow,
             count(*)::int AS n
      FROM "AuditLog" a WHERE a."createdAt" >= ${from}
      GROUP BY 1 ORDER BY n DESC LIMIT 1`,
  ]);

  const t = totalsRows[0] ?? { total: 0, users: 0, logins: 0 };
  const busiestHour = hours.length ? hours.reduce((a, b) => (b.n > a.n ? b : a)).hour : null;

  return {
    days,
    totals: { activeUsers: t.users, totalActions: t.total, logins: t.logins },
    busiest: { day: busyDay[0]?.dow ?? null, hour: busiestHour },
    topFeatures: features.map((f) => ({ key: f.action, label: labelForAction(f.action), count: f.n })),
    byOffice: offices.map((o) => ({ office: o.office ?? 'Internal / no office', count: o.n })),
    byPerson: people.map((p) => ({ userId: p.userId, name: p.name, office: p.office, count: p.n })),
    daily: daily.map((d) => ({ date: d.date, count: d.n })),
    byHour: hours.map((h) => ({ hour: h.hour, count: h.n })),
  };
}

export interface UserUsage {
  user: { id: string; name: string; email: string; office: string | null; role: string } | null;
  days: number;
  totals: { totalActions: number; activeDays: number; lastActive: Date | null };
  topFeatures: LabeledCount[];
  daily: DayCount[];
  recent: { action: string; label: string; entityType: string; detail: string | null; at: Date }[];
}

export async function getUserUsage(userId: string, days = 30): Promise<UserUsage> {
  const from = fromDate(days);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, dealer: { select: { name: true } } },
  });

  const [totalsRows, features, daily, recent] = await Promise.all([
    prisma.$queryRaw<{ total: number; days: number; last: Date | null }[]>`
      SELECT count(*)::int AS total,
             count(DISTINCT date_trunc('day', "createdAt" AT TIME ZONE ${TZ}))::int AS days,
             max("createdAt") AS last
      FROM "AuditLog" WHERE "actorId" = ${userId} AND "createdAt" >= ${from}`,
    prisma.$queryRaw<{ action: string; n: number }[]>`
      SELECT action, count(*)::int AS n FROM "AuditLog"
      WHERE "actorId" = ${userId} AND "createdAt" >= ${from}
      GROUP BY action ORDER BY n DESC LIMIT 12`,
    prisma.$queryRaw<{ date: string; n: number }[]>`
      SELECT to_char(date_trunc('day', "createdAt" AT TIME ZONE ${TZ}), 'YYYY-MM-DD') AS date,
             count(*)::int AS n
      FROM "AuditLog" WHERE "actorId" = ${userId} AND "createdAt" >= ${from}
      GROUP BY 1 ORDER BY 1`,
    prisma.auditLog.findMany({
      where: { actorId: userId, createdAt: { gte: from } },
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: { action: true, entityType: true, detail: true, createdAt: true },
    }),
  ]);

  const t = totalsRows[0] ?? { total: 0, days: 0, last: null };
  return {
    user: user ? { id: user.id, name: user.name, email: user.email, office: user.dealer?.name ?? null, role: user.role } : null,
    days,
    totals: { totalActions: t.total, activeDays: t.days, lastActive: t.last },
    topFeatures: features.map((f) => ({ key: f.action, label: labelForAction(f.action), count: f.n })),
    daily: daily.map((d) => ({ date: d.date, count: d.n })),
    recent: recent.map((r) => ({ action: r.action, label: labelForAction(r.action), entityType: r.entityType, detail: r.detail, at: r.createdAt })),
  };
}
