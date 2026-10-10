import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { requireAdminSection } from '@/lib/session';
import { newRecordingStorageKey, presignRecordingUpload, storageIsS3 } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Video types we accept for a manual recording upload, mapped to a file ext.
const ALLOWED: Record<string, string> = {
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
  'video/x-matroska': '.mkv',
  'video/x-msvideo': '.avi',
};
const MAX_BYTES = 3 * 1024 * 1024 * 1024; // 3 GB

/**
 * Hand back a short-lived presigned S3 PUT URL so the browser can upload a
 * recording video straight to S3 (the bytes never pass through this server).
 * Admin-only (zoom-recordings). The follow-up createManualFileRecordingAction
 * records the row once the upload finishes.
 */
export async function POST(req: NextRequest) {
  await requireAdminSection('zoom-recordings');

  if (!storageIsS3()) {
    return NextResponse.json({ error: 'File uploads need S3 storage, which isn’t configured here. Paste a link instead.' }, { status: 400 });
  }

  let body: { filename?: string; contentType?: string; sizeBytes?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }

  const contentType = String(body.contentType || '').toLowerCase().trim();
  const ext = ALLOWED[contentType] || path.extname(String(body.filename || '')).toLowerCase();
  if (!ALLOWED[contentType]) {
    return NextResponse.json({ error: 'Use a video file (MP4, MOV, WEBM, MKV or AVI).' }, { status: 400 });
  }
  const size = Math.round(Number(body.sizeBytes) || 0);
  if (size <= 0) return NextResponse.json({ error: 'Empty file.' }, { status: 400 });
  if (size > MAX_BYTES) {
    return NextResponse.json({ error: 'That file is over the 3 GB limit. Upload it to Zoom/Drive/YouTube and paste the link instead.' }, { status: 400 });
  }

  const key = newRecordingStorageKey(ext);
  try {
    const url = await presignRecordingUpload(key, contentType);
    return NextResponse.json({ url, key });
  } catch (e) {
    console.error('[recordings/presign] failed', e);
    return NextResponse.json({ error: 'Could not start the upload.' }, { status: 500 });
  }
}
