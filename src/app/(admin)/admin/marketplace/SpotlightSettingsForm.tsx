'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { saveSpotlightSettingsAction } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-secondary" disabled={pending}>
      {pending ? 'Saving…' : 'Save'}
    </button>
  );
}

export function SpotlightSettingsForm({
  config,
}: {
  config: { enabled: boolean; targetCount: number; freshDays: number };
}) {
  const [state, action] = useFormState(saveSpotlightSettingsAction, {} as { ok?: boolean });
  return (
    <form action={action} className="space-y-4">
      <label className="flex items-start gap-3">
        <input type="checkbox" name="enabled" defaultChecked={config.enabled} className="mt-0.5 h-4 w-4" />
        <span>
          <span className="font-medium text-gray-900">Auto-rotate the New Arrivals showcase</span>
          <span className="block text-xs text-gray-500">
            Keeps the showcase fresh on its own — no one has to curate it. Newly added items show right away
            with a &ldquo;New&rdquo; badge, and the rest of the strip rotates to different products each week.
            Items you mark <em>Featured</em> are always pinned in. Turn this off to go back to showing only your
            Featured items.
          </span>
        </span>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">Items to show in the strip</span>
          <input name="targetCount" type="number" min={1} max={24} defaultValue={config.targetCount} className="input" />
        </label>
        <label className="block">
          <span className="label">Count a product &ldquo;new&rdquo; for (days)</span>
          <input name="freshDays" type="number" min={0} max={180} defaultValue={config.freshDays} className="input" />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <SubmitButton />
        {state.ok && <span className="text-xs text-green-600">Saved.</span>}
      </div>
    </form>
  );
}
