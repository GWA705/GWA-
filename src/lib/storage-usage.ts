import { prisma } from './db';

export interface StorageUsage {
  totalBytes: number;
  documents: { bytes: number; count: number };
  mail: { bytes: number; count: number };
  marketplace: { bytes: number; count: number };
  driver: 's3' | 'local';
  bucket: string | null;
  region: string | null;
}

/**
 * How much file storage we're consuming, summed from the recorded size of every
 * stored object (documents, mail attachments, marketplace photos). This is the
 * plaintext byte count we saved at upload time — a close estimate of what the
 * storage backend holds — and avoids a slow/costly bucket-listing call.
 */
export async function getStorageUsage(): Promise<StorageUsage> {
  const [docs, mail, mkt] = await Promise.all([
    prisma.document.aggregate({ _sum: { sizeBytes: true }, _count: { _all: true } }),
    prisma.mailAttachment.aggregate({ _sum: { sizeBytes: true }, _count: { _all: true } }),
    prisma.marketplaceItem.aggregate({ _sum: { imageSizeBytes: true }, _count: { imageStorageKey: true } }),
  ]);

  const documents = { bytes: Number(docs._sum.sizeBytes ?? 0), count: docs._count._all };
  const m = { bytes: Number(mail._sum.sizeBytes ?? 0), count: mail._count._all };
  const marketplace = { bytes: Number(mkt._sum.imageSizeBytes ?? 0), count: mkt._count.imageStorageKey };

  const driver = (process.env.STORAGE_DRIVER as 's3' | 'local') || 'local';
  return {
    totalBytes: documents.bytes + m.bytes + marketplace.bytes,
    documents,
    mail: m,
    marketplace,
    driver,
    bucket: driver === 's3' ? process.env.S3_BUCKET || null : null,
    region: driver === 's3' ? process.env.S3_REGION || 'ca-central-1' : null,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(i === 0 || v >= 100 ? 0 : 1)} ${units[i]}`;
}
