import 'server-only';
import crypto from 'crypto';
import { prisma } from './db';
import { putDocument, getDocument, deleteDocument } from './storage';
import { emailEnabled, getEmailIdentityInfo } from './email';
import { journalDiagnostics, pingSheet, leadsSheetId, sheetIdFor, EARLIEST_JOURNAL_YEAR } from './reporting/journalRead';

/**
 * System health — a live status check of every external connection feeding the
 * portal, for the Admin → System health dashboard. Everything is probed fresh
 * on each call.
 */

export type HealthStatus = 'ok' | 'warn' | 'error' | 'notset';

export interface HealthCheck {
  key: string;
  label: string;
  status: HealthStatus;
  detail?: string;
  hint?: string;
  group: 'Core' | 'Google Workspace';
}

export interface SystemHealth {
  serviceAccountEmail: string | null;
  checks: HealthCheck[];
  okCount: number;
  problemCount: number;
}

async function checkDatabase(): Promise<HealthCheck> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { key: 'db', label: 'Database', status: 'ok', detail: 'Connected (PostgreSQL / RDS).', group: 'Core' };
  } catch (e) {
    return { key: 'db', label: 'Database', status: 'error', detail: (e as Error).message, group: 'Core' };
  }
}

async function checkStorage(): Promise<HealthCheck> {
  const driver = (process.env.STORAGE_DRIVER as string) || 'local';
  const where =
    driver === 's3'
      ? `S3 (${process.env.S3_BUCKET || '?'}, ${process.env.S3_REGION || 'ca-central-1'})`
      : 'Local disk';
  const key = `health/ping-${crypto.randomBytes(6).toString('hex')}.txt`;
  try {
    await putDocument(key, Buffer.from('ok'));
    const back = await getDocument(key);
    await deleteDocument(key).catch(() => {});
    if (back.toString() !== 'ok') {
      return { key: 'storage', label: 'File storage', status: 'error', detail: `${where} — read-back mismatch`, group: 'Core' };
    }
    return { key: 'storage', label: 'File storage', status: 'ok', detail: `${where} — encrypted read/write OK`, group: 'Core' };
  } catch (e) {
    return {
      key: 'storage',
      label: 'File storage',
      status: 'error',
      detail: (e as Error).message,
      hint: driver === 's3' ? 'Check S3_BUCKET, region and AWS credentials.' : undefined,
      group: 'Core',
    };
  }
}

async function checkEmail(): Promise<HealthCheck> {
  if (emailEnabled()) {
    const id = await getEmailIdentityInfo().catch(() => null);
    const from = id?.effective.fromEmail;
    return {
      key: 'email',
      label: 'Email (SMTP)',
      status: 'ok',
      detail: `Sending live${from ? ` from ${from}` : ''}.`,
      group: 'Core',
    };
  }
  return {
    key: 'email',
    label: 'Email (SMTP)',
    status: 'warn',
    detail: 'Log-only mode — notifications are written to the server log, not emailed.',
    hint: 'Set SMTP_HOST, SMTP_USER and SMTP_PASS to send real email.',
    group: 'Core',
  };
}

export async function getSystemHealth(): Promise<SystemHealth> {
  const currentYear = new Date().getFullYear();
  // The active window (last / this / next year) plus any older journal that is
  // actually configured (e.g. the 2024 book), so its connection shows up too.
  const years = new Set<number>([currentYear - 1, currentYear, currentYear + 1]);
  for (let y = EARLIEST_JOURNAL_YEAR; y < currentYear - 1; y += 1) {
    if (sheetIdFor(y)) years.add(y);
  }
  const yearList = [...years].sort((a, b) => a - b);

  const [db, storage, email, diag] = await Promise.all([
    checkDatabase(),
    checkStorage(),
    checkEmail(),
    journalDiagnostics(yearList),
  ]);

  const checks: HealthCheck[] = [db, storage, email];

  // Google service account itself.
  checks.push({
    key: 'google-sa',
    label: 'Google service account',
    status: diag.hasCredentials ? (diag.serviceAccountEmail ? 'ok' : 'warn') : 'error',
    detail: diag.serviceAccountEmail
      ? `Authenticated as ${diag.serviceAccountEmail}`
      : diag.hasCredentials
        ? 'Credentials present but the account email could not be read.'
        : 'No Google credentials configured on the server.',
    hint: diag.serviceAccountEmail ? 'Share each sheet below with this address (Viewer).' : undefined,
    group: 'Google Workspace',
  });

  // Sales journals per year.
  for (const y of diag.years) {
    checks.push({
      key: `journal-${y.year}`,
      label: `Sales journal ${y.year}`,
      status: !y.configured ? 'notset' : y.ok ? 'ok' : 'error',
      detail: y.ok
        ? `${y.title} · ${y.monthTabs} month tab${y.monthTabs === 1 ? '' : 's'}`
        : y.configured
          ? y.error || 'Could not open this sheet.'
          : `No sheet id set (JOURNAL_SHEET_ID_${y.year}).`,
      hint: y.configured && !y.ok ? 'Share this year’s sheet with the service account.' : undefined,
      group: 'Google Workspace',
    });
  }

  // HD leads log.
  const leadsId = leadsSheetId();
  if (!leadsId) {
    checks.push({
      key: 'leads',
      label: 'HD leads log',
      status: 'notset',
      detail: 'No sheet id set (HD_LEADS_SHEET_ID).',
      group: 'Google Workspace',
    });
  } else {
    const ping = await pingSheet(leadsId);
    checks.push({
      key: 'leads',
      label: 'HD leads log',
      status: ping.error ? 'error' : 'ok',
      detail: ping.error ? ping.error : `${ping.title} · ${ping.tabs?.length ?? 0} tab${ping.tabs?.length === 1 ? '' : 's'}`,
      hint: ping.error ? 'Share the HD leads log with the service account (Viewer).' : undefined,
      group: 'Google Workspace',
    });
  }

  const problem = checks.filter((c) => c.status === 'error').length;
  const ok = checks.filter((c) => c.status === 'ok').length;
  return { serviceAccountEmail: diag.serviceAccountEmail, checks, okCount: ok, problemCount: problem };
}
