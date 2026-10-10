import { requireAdminSection } from '@/lib/session';
import { prisma } from '@/lib/db';
import { zoomConfigured, formatBytes } from '@/lib/zoom';
import { storageIsS3 } from '@/lib/storage';
import { ZoomSyncBar, ZoomAdminRow, ManualAddCard, type ZoomRow } from './ZoomAdmin';

export const dynamic = 'force-dynamic';

export default async function ZoomRecordingsAdminPage() {
  await requireAdminSection('zoom-recordings');
  const configured = zoomConfigured();
  const canUpload = storageIsS3();

  const all = await prisma.zoomRecording.findMany({ orderBy: { startTime: 'desc' }, take: 300 });
  const toRow = (r: (typeof all)[number]): ZoomRow => ({
    id: r.id,
    topic: r.topic,
    title: r.title ?? '',
    description: r.description ?? '',
    dateLabel: r.startTime.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' }),
    durationMin: r.durationMin,
    sizeLabel: formatBytes(Number(r.totalSize)),
    shareUrl: r.shareUrl,
    passcode: r.passcode ?? '',
    status: r.status,
    source: r.source,
    hasFile: !!r.fileKey,
  });

  const pending = all.filter((r) => r.status === 'PENDING').map(toRow);
  const published = all.filter((r) => r.status === 'PUBLISHED').map(toRow);
  const hidden = all.filter((r) => r.status === 'HIDDEN').map(toRow);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Zoom recordings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Recordings sync in from Zoom automatically and land here for review. <strong>Publish</strong> the ones that
          should go live — published recordings show to all dealers under <em>Recordings</em> with a Watch/Download link
          and passcode. Dealers never see pending or hidden ones.
        </p>
      </div>

      {!configured && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <span className="font-semibold">Zoom isn’t connected yet.</span> Create a Zoom <strong>Server-to-Server OAuth</strong> app
          (scope <code>recording:read:admin</code>) and set <code>ZOOM_ACCOUNT_ID</code>, <code>ZOOM_CLIENT_ID</code> and
          <code> ZOOM_CLIENT_SECRET</code> on Elastic Beanstalk. See <code>docs/ZOOM-RECORDINGS.md</code>.
        </div>
      )}

      <ZoomSyncBar configured={configured} />

      <ManualAddCard canUpload={canUpload} />

      <Section title={`To review${pending.length ? ` · ${pending.length}` : ''}`} empty="Nothing waiting for review." rows={pending} />
      <Section title={`Published${published.length ? ` · ${published.length}` : ''}`} empty="Nothing published yet." rows={published} />
      {hidden.length > 0 && <Section title={`Hidden · ${hidden.length}`} empty="" rows={hidden} />}
    </div>
  );
}

function Section({ title, empty, rows }: { title: string; empty: string; rows: ZoomRow[] }) {
  return (
    <div className="card p-5">
      <h2 className="mb-3 text-base font-semibold text-gray-900">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">{empty}</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => <ZoomAdminRow key={r.id} row={r} />)}
        </ul>
      )}
    </div>
  );
}
