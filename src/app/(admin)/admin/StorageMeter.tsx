import { formatBytes, type StorageUsage } from '@/lib/storage-usage';

export function StorageMeter({ usage }: { usage: StorageUsage }) {
  const total = usage.totalBytes || 1;
  const parts = [
    { label: 'Documents', bytes: usage.documents.bytes, count: usage.documents.count, cls: 'bg-brand-600' },
    { label: 'Mail attachments', bytes: usage.mail.bytes, count: usage.mail.count, cls: 'bg-sky-500' },
    { label: 'Marketplace photos', bytes: usage.marketplace.bytes, count: usage.marketplace.count, cls: 'bg-amber-500' },
  ];
  const backend =
    usage.driver === 's3'
      ? `S3${usage.bucket ? ` · ${usage.bucket}` : ''}${usage.region ? ` · ${usage.region}` : ''}`
      : 'Local disk (dev)';

  return (
    <div className="card p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold text-gray-900">Storage used</h2>
        <span className="text-xs text-gray-500">{backend}</span>
      </div>
      <div className="mt-1 text-3xl font-bold tabular-nums text-gray-900">{formatBytes(usage.totalBytes)}</div>

      <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
        {parts
          .filter((p) => p.bytes > 0)
          .map((p) => (
            <div key={p.label} className={p.cls} style={{ width: `${(p.bytes / total) * 100}%` }} />
          ))}
      </div>

      <ul className="mt-3 space-y-1 text-sm">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-gray-600">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${p.cls}`} aria-hidden />
              {p.label} <span className="text-gray-400">({p.count})</span>
            </span>
            <span className="tabular-nums text-gray-700">{formatBytes(p.bytes)}</span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-gray-400">
        Estimated from stored file sizes{usage.driver === 's3' ? ' — billed by your S3 provider per GB-month' : ''}.
      </p>
    </div>
  );
}
