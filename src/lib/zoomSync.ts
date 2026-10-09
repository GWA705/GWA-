import 'server-only';
import { prisma } from './db';
import { zoomConfigured, listCloudRecordings } from './zoom';

export interface ZoomSyncResult {
  configured: boolean;
  added?: number; // new recordings queued for review
  seen?: number; // recordings returned by Zoom
  error?: string;
}

/**
 * Pull recent Zoom cloud recordings and queue any new ones for review (status
 * PENDING). Deduped by the Zoom meeting UUID. Existing rows keep their
 * admin-owned fields (status, title, description); only the Zoom-sourced facts
 * are refreshed. Default window: the last `days` days (Zoom caps a query at a
 * month).
 */
export async function syncZoomRecordings(days = 35): Promise<ZoomSyncResult> {
  if (!zoomConfigured()) return { configured: false };

  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

  let recs;
  try {
    recs = await listCloudRecordings(from, to);
  } catch (e) {
    console.error('[zoomSync] list failed', e);
    return { configured: true, error: 'Could not reach Zoom.' };
  }

  let added = 0;
  for (const r of recs) {
    const existing = await prisma.zoomRecording.findUnique({ where: { uuid: r.uuid }, select: { id: true, passcode: true } });
    if (existing) {
      // Refresh Zoom-sourced facts only; never touch status/title/description.
      await prisma.zoomRecording.update({
        where: { uuid: r.uuid },
        data: {
          topic: r.topic,
          startTime: r.startTime,
          durationMin: r.durationMin,
          shareUrl: r.shareUrl,
          fileCount: r.fileCount,
          totalSize: BigInt(r.totalSize),
          // Only fill a passcode we didn't already have (keep an admin-entered one).
          ...(existing.passcode ? {} : r.passcode ? { passcode: r.passcode } : {}),
        },
      });
    } else {
      await prisma.zoomRecording.create({
        data: {
          uuid: r.uuid,
          meetingId: r.meetingId,
          topic: r.topic,
          startTime: r.startTime,
          durationMin: r.durationMin,
          shareUrl: r.shareUrl,
          passcode: r.passcode,
          fileCount: r.fileCount,
          totalSize: BigInt(r.totalSize),
          status: 'PENDING',
        },
      });
      added += 1;
    }
  }

  return { configured: true, added, seen: recs.length };
}
