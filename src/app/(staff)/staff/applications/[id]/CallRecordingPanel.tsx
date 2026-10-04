import { Phone } from 'lucide-react';

export interface CallRecordingView {
  id: string;
  createdAtLabel: string;
  durationLabel: string | null;
  statusLabel: string;
  byName: string | null;
}

/**
 * Call recordings for this deal. GROUNDWORK: until Twilio Voice is switched on
 * (see src/lib/voice.ts), there are never any recordings and this shows an
 * inactive notice so the place they'll live is already on the customer's deal.
 * Once voice is live, recordings of the confirmation call list here.
 */
export function CallRecordingPanel({
  enabled,
  recordings = [],
}: {
  enabled: boolean;
  recordings?: CallRecordingView[];
}) {
  return (
    <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="mb-1 flex items-center gap-2 text-sm font-medium text-gray-700">
        <Phone size={15} className="text-gray-400" />
        Call recording
      </div>
      {recordings.length === 0 ? (
        <p className="text-xs text-gray-500">
          {enabled
            ? 'No recordings on this deal yet. Recorded confirmation calls will appear here.'
            : 'Not set up yet. When Twilio Voice is enabled, recordings of this confirmation call attach here, on the customer’s deal.'}
        </p>
      ) : (
        <ul className="divide-y divide-gray-200 text-sm">
          {recordings.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-2">
              <span className="text-gray-700">
                {r.createdAtLabel}
                {r.durationLabel ? ` · ${r.durationLabel}` : ''}
                {r.byName ? ` · ${r.byName}` : ''}
              </span>
              <span className="badge bg-gray-100 text-gray-600">{r.statusLabel}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
