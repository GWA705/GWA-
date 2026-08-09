import { gzipSync } from 'zlib';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { putDocument, getDocument } from '@/lib/storage';

/**
 * Self-managed database export — extra insurance on top of the cloud provider's
 * own backups. It reads every table, writes a single JSON archive, gzips it, and
 * stores it (application-encrypted, like every uploaded file) under the
 * `db-backups/` prefix in the same Canadian storage bucket. Encrypted personal
 * fields stay encrypted in the archive, so the backup is never a plaintext-PII
 * export.
 *
 * Triggered weekly by a scheduler hitting /api/cron/db-backup. Restore with
 * readDatabaseBackup(key) (or download the object and decrypt it the same way
 * documents are decrypted).
 */

export const BACKUP_PREFIX = 'db-backups/';

// JSON.stringify already turns Date and Prisma.Decimal into strings via their
// toJSON; the one primitive it can't serialize on its own is BigInt.
export function backupReplacer(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  return value;
}

function stamp(now: Date): string {
  // YYYY-MM-DD-HHmm in UTC (stable, sortable filenames).
  const iso = now.toISOString(); // 2026-08-09T14:03:22.000Z
  return `${iso.slice(0, 10)}-${iso.slice(11, 13)}${iso.slice(14, 16)}`;
}

export interface BackupResult {
  key: string;
  bytes: number;
  models: number;
  rows: number;
  counts: Record<string, number>;
}

/** Run a full database export and store it. `now` is injected for testability. */
export async function runDatabaseBackup(now: Date = new Date()): Promise<BackupResult> {
  const models = Prisma.dmmf.datamodel.models;
  const data: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};
  let rows = 0;

  for (const model of models) {
    const delegateName = model.name.charAt(0).toLowerCase() + model.name.slice(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const delegate = (prisma as any)[delegateName];
    if (!delegate || typeof delegate.findMany !== 'function') continue;
    const records = await delegate.findMany();
    data[model.name] = records;
    counts[model.name] = records.length;
    rows += records.length;
  }

  const payload = {
    meta: {
      app: 'gwa-portal',
      generatedAt: now.toISOString(),
      models: Object.keys(data).length,
      rows,
      counts,
    },
    data,
  };

  const json = JSON.stringify(payload, backupReplacer);
  const gz = gzipSync(Buffer.from(json, 'utf8'));
  const key = `${BACKUP_PREFIX}gwa-db-${stamp(now)}.json.gz`;
  // putDocument application-encrypts the bytes before storing (see lib/storage).
  const stored = await putDocument(key, gz);

  return { key, bytes: stored.sizeBytes ?? gz.length, models: payload.meta.models, rows, counts };
}

/** Fetch and decrypt a stored backup, returning the gzipped archive bytes. */
export async function readDatabaseBackup(key: string): Promise<Buffer> {
  return getDocument(key);
}
