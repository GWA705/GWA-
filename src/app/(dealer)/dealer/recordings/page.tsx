import { requireDealerAccess } from '@/lib/session';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

function fmtDuration(min: number): string {
  if (!min) return '';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export default async function DealerRecordingsPage() {
  await requireDealerAccess();
  const recordings = await prisma.zoomRecording.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { startTime: 'desc' },
    take: 200,
  });

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-slate-100">Recordings</h1>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-slate-400">
          Meeting recordings from the Georgian Water &amp; Air team — watch or download any time.
        </p>
      </div>

      {recordings.length === 0 ? (
        <div className="card p-8 text-center text-sm text-gray-500 dark:text-slate-400">No recordings posted yet.</div>
      ) : (
        <ul className="space-y-3">
          {recordings.map((r) => (
            <li key={r.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">{r.title?.trim() || r.topic}</h2>
                  <div className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">
                    🗓 {r.startTime.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })}
                    {r.durationMin ? ` · ⏱ ${fmtDuration(r.durationMin)}` : ''}
                  </div>
                  {r.description?.trim() && (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700 dark:text-slate-200">{r.description}</p>
                  )}
                </div>
                <a
                  href={r.fileKey ? `/api/recordings/${r.id}/file` : r.shareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary shrink-0 text-sm"
                >
                  ▶ Watch / Download
                </a>
              </div>
              {r.passcode && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3 text-sm dark:border-slate-700">
                  <span className="text-gray-500 dark:text-slate-400">Passcode:</span>
                  <code className="select-all rounded bg-gray-100 px-2 py-0.5 font-mono text-gray-800 dark:bg-slate-700 dark:text-slate-100">{r.passcode}</code>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
