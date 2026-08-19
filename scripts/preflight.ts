/**
 * Startup preflight.
 *
 * Runs after migrations and before the web server accepts a request. Two jobs.
 *
 * 1. Fail loudly on missing or malformed configuration, rather than crashing
 *    later with something cryptic buried in a service log.
 *
 * 2. Prove the encryption key still matches the data. This is the important
 *    one. Application-level encryption means a changed MASTER_ENCRYPTION_KEY
 *    does not throw on startup — decryption fails per field, at read time,
 *    long after the deploy looked successful. Staff would see blanks and
 *    errors on applications while the service reported healthy.
 *
 *    So on first boot we store an encrypted canary, and on every boot after we
 *    decrypt it. If that fails, we refuse to start. Refusing is deliberate: a
 *    portal that will not start is a support call, while a portal serving
 *    unreadable SIN and banking fields is a data incident.
 */

import { PrismaClient } from '@prisma/client';
import { encryptString, decryptString } from '../src/lib/crypto';

const prisma = new PrismaClient();

const CANARY_KEY = 'encryption_canary';
const CANARY_VALUE = 'gwa-credit-portal-encryption-canary-v1';

function fail(message: string, detail?: string): never {
  console.error('');
  console.error('[preflight] ✖ FAILED');
  console.error('');
  console.error(`[preflight]   ${message}`);
  if (detail) {
    console.error('');
    for (const line of detail.split('\n')) console.error(`[preflight] ${line}`);
  }
  console.error('');
  process.exit(1);
}

async function main() {
  console.log('[preflight] Checking configuration...');

  // ── Required configuration ──────────────────────────────────────────────
  const required: { key: string; why: string }[] = [
    { key: 'DATABASE_URL', why: 'the portal has nowhere to read or write.' },
    { key: 'SESSION_SECRET', why: 'nobody can sign in.' },
  ];
  const missing = required.filter((r) => !process.env[r.key]);
  if (missing.length) {
    fail(
      `Missing required configuration: ${missing.map((m) => m.key).join(', ')}`,
      missing.map((m) => `  ${m.key} — without it, ${m.why}`).join('\n'),
    );
  }

  // The encryption key is required unless KMS is wired up.
  if (!process.env.MASTER_ENCRYPTION_KEY && !process.env.KMS_KEY_ID) {
    fail(
      'MASTER_ENCRYPTION_KEY is not set (and KMS_KEY_ID is not configured).',
      '  Encrypted fields — SIN, banking, DOB, government ID — cannot be read\n' +
      '  or written without it.',
    );
  }

  // Mirror what src/lib/crypto.ts will actually accept: a base64-encoded
  // 32-byte key, or any secret of at least 16 characters (which it hashes).
  const raw = process.env.MASTER_ENCRYPTION_KEY;
  if (raw) {
    const isBase64Key = Buffer.from(raw, 'base64').length === 32;
    if (!isBase64Key && raw.length < 16) {
      fail(
        'MASTER_ENCRYPTION_KEY is too short to be usable.',
        '  Provide a base64-encoded 32-byte key:\n' +
        '      openssl rand -base64 32\n' +
        '  ...or a random secret of at least 16 characters.\n\n' +
        '  Only generate a NEW key for a NEW, empty database.',
      );
    }
  }

  console.log('[preflight] ✔ Configuration present and well-formed.');

  // ── Database reachable ──────────────────────────────────────────────────
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('[preflight] ✔ Database reachable.');
  } catch (err) {
    fail(
      'Could not reach the database.',
      `  ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // ── Encryption canary ───────────────────────────────────────────────────
  const existing = await prisma.appSetting.findUnique({
    where: { key: CANARY_KEY },
    select: { value: true },
  });

  if (!existing) {
    // First boot against this database. Plant the canary so every later boot
    // has something to check against.
    await prisma.appSetting.create({
      data: { key: CANARY_KEY, value: encryptString(CANARY_VALUE) },
    });
    console.log('[preflight] ✔ Encryption canary planted (first boot against this database).');
  } else {
    try {
      if (decryptString(existing.value) !== CANARY_VALUE) {
        throw new Error('canary contents did not match');
      }
      console.log('[preflight] ✔ Encryption key matches the data in this database.');
    } catch {
      const applications = await prisma.application.count().catch(() => 0);
      fail(
        'MASTER_ENCRYPTION_KEY does not match the data in this database.',
        [
          '  This database holds data encrypted with a DIFFERENT key.',
          `  ${applications.toLocaleString('en-CA')} credit application${applications === 1 ? '' : 's'} would have unreadable`,
          '  SIN, banking, date-of-birth, address and government ID fields.',
          '',
          '  The portal is refusing to start rather than serving those blanks to',
          '  staff: with application-level encryption a wrong key does not crash,',
          '  it quietly corrupts every screen while the service reports healthy.',
          '',
          '  Most likely one of:',
          '    · the key was regenerated — check it is set BY HAND in the Render',
          '      dashboard, not with generateValue in render.yaml',
          '    · this deploy is pointed at the wrong database',
          '    · a database backup was restored that predates the current key',
          '',
          '  Restore the original MASTER_ENCRYPTION_KEY and deploy again. Without',
          '  it, those fields cannot be recovered by any means.',
        ].join('\n'),
      );
    }
  }

  console.log('[preflight] Preflight passed.');
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('[preflight] Unexpected error:', err);
  await prisma.$disconnect();
  process.exit(1);
});
