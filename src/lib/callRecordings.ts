import 'server-only';
import crypto from 'crypto';
import { prisma } from './db';
import { putDocument, deleteDocument } from './storage';
import { dubberEnabled, dubberListRecordings, dubberDownloadRecording, type DubberRecording } from './dubber';

/**
 * Customer call recordings — pulled from Bell Total Connect (Dubber) or uploaded
 * by hand, stored (encrypted) via the same document store as everything else,
 * and attached to the matching deal by the customer's phone number.
 */

/** Last 10 digits of a phone, for tolerant matching across formats. */
export function normalizePhone(raw: string | null | undefined): string {
  const digits = String(raw ?? '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

function extFor(mime: string): string {
  if (/mp3|mpeg/i.test(mime)) return '.mp3';
  if (/wav/i.test(mime)) return '.wav';
  if (/ogg/i.test(mime)) return '.ogg';
  if (/m4a|mp4|aac/i.test(mime)) return '.m4a';
  return '.audio';
}

function recordingKey(ext: string): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `call-recordings/${y}/${m}/${crypto.randomBytes(16).toString('hex')}${ext}`;
}

/**
 * Find the deal a recording belongs to by phone. When a customer has more than
 * one deal, prefer the one whose sale/created date is closest to the call; else
 * the most recent. Returns null when nothing matches (the recording is still
 * stored, just unattributed until someone links it).
 */
export async function matchApplicationByPhone(
  phones: (string | null | undefined)[],
  near?: Date | null,
): Promise<{ applicationId: string; dealerId: string; phone: string } | null> {
  const wanted = Array.from(new Set(phones.map(normalizePhone).filter((p) => p.length === 10)));
  if (wanted.length === 0) return null;

  // Pull candidate deals and match in JS (applicantPhone is stored formatted).
  const apps = await prisma.application.findMany({
    where: { status: { notIn: ['DRAFT'] } },
    select: { id: true, dealerId: true, applicantPhone: true, dateOfSale: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 5000,
  });
  const matches = apps.filter((a) => wanted.includes(normalizePhone(a.applicantPhone)));
  if (matches.length === 0) return null;

  const pick = near
    ? matches.reduce((best, a) => {
        const at = (a.dateOfSale ?? a.createdAt).getTime();
        const bd = Math.abs((best.dateOfSale ?? best.createdAt).getTime() - near.getTime());
        return Math.abs(at - near.getTime()) < bd ? a : best;
      }, matches[0])
    : matches[0];

  return { applicationId: pick.id, dealerId: pick.dealerId, phone: normalizePhone(pick.applicantPhone) };
}

/** Store audio bytes and return the storage key + size. */
async function storeAudio(buffer: Buffer, mime: string): Promise<{ key: string; size: number }> {
  const key = recordingKey(extFor(mime));
  const stored = await putDocument(key, buffer);
  return { key, size: stored.sizeBytes };
}

/** Ingest one Dubber recording (dedupes by externalId). */
export async function ingestDubberRecording(rec: DubberRecording): Promise<'created' | 'duplicate' | 'error'> {
  try {
    const existing = await prisma.callRecording.findUnique({ where: { externalId: rec.externalId }, select: { id: true } });
    if (existing) return 'duplicate';

    const match = await matchApplicationByPhone([rec.fromNumber, rec.toNumber], rec.startedAt);
    const { buffer, mime } = await dubberDownloadRecording(rec);
    const { key, size } = await storeAudio(buffer, mime);

    await prisma.callRecording.create({
      data: {
        source: 'dubber',
        externalId: rec.externalId,
        direction: rec.direction,
        fromNumber: rec.fromNumber,
        toNumber: rec.toNumber,
        matchedPhone: match?.phone ?? null,
        startedAt: rec.startedAt,
        durationSec: rec.durationSec,
        storageKey: key,
        mime,
        sizeBytes: size,
        applicationId: match?.applicationId ?? null,
        dealerId: match?.dealerId ?? null,
      },
    });
    return 'created';
  } catch {
    return 'error';
  }
}

/** Pull new Dubber recordings since the last one we stored (or 7 days back). */
export async function sweepCallRecordings(): Promise<{ pulled: number; created: number; duplicates: number; errors: number }> {
  if (!dubberEnabled()) return { pulled: 0, created: 0, duplicates: 0, errors: 0 };
  const last = await prisma.callRecording.findFirst({ where: { source: 'dubber' }, orderBy: { startedAt: 'desc' }, select: { startedAt: true } });
  const since = last?.startedAt ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recs = await dubberListRecordings(since);
  let created = 0, duplicates = 0, errors = 0;
  for (const r of recs) {
    const out = await ingestDubberRecording(r);
    if (out === 'created') created += 1;
    else if (out === 'duplicate') duplicates += 1;
    else errors += 1;
  }
  return { pulled: recs.length, created, duplicates, errors };
}

/** Manually attach an uploaded recording to a deal. */
export async function attachManualRecording(input: {
  applicationId: string;
  dealerId: string | null;
  buffer: Buffer;
  mime: string;
  uploadedById: string;
}): Promise<void> {
  const { key, size } = await storeAudio(input.buffer, input.mime);
  await prisma.callRecording.create({
    data: {
      source: 'manual',
      storageKey: key,
      mime: input.mime,
      sizeBytes: size,
      startedAt: new Date(),
      applicationId: input.applicationId,
      dealerId: input.dealerId,
      uploadedById: input.uploadedById,
    },
  });
}

export interface RecordingRow {
  id: string;
  source: string;
  direction: string | null;
  startedAt: string | null;
  durationSec: number | null;
  sizeBytes: number | null;
  mime: string;
}

/** Recordings attached to a deal, newest first. */
export async function listRecordingsForApplication(applicationId: string): Promise<RecordingRow[]> {
  const rows = await prisma.callRecording.findMany({
    where: { applicationId },
    orderBy: [{ startedAt: 'desc' }, { createdAt: 'desc' }],
    select: { id: true, source: true, direction: true, startedAt: true, durationSec: true, sizeBytes: true, mime: true },
  });
  return rows.map((r) => ({
    id: r.id,
    source: r.source,
    direction: r.direction,
    startedAt: r.startedAt ? r.startedAt.toISOString() : null,
    durationSec: r.durationSec,
    sizeBytes: r.sizeBytes,
    mime: r.mime,
  }));
}

/** Remove a recording (row + stored audio). */
export async function deleteRecording(id: string): Promise<void> {
  const rec = await prisma.callRecording.findUnique({ where: { id }, select: { storageKey: true } });
  if (!rec) return;
  await prisma.callRecording.delete({ where: { id } });
  try {
    await deleteDocument(rec.storageKey);
  } catch {
    /* best-effort */
  }
}
