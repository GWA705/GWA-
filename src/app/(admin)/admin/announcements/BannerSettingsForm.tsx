'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { saveBannerSettingsAction } from '@/app/(admin)/actions';

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Saving…' : 'Save slideshow settings'}
    </button>
  );
}

function Toggle({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-700">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4 rounded border-gray-300" />
      {label}
    </label>
  );
}

export function BannerSettingsForm({ top, bottom }: { top: boolean; bottom: boolean }) {
  const [state, action] = useFormState(saveBannerSettingsAction, {} as { error?: string; ok?: boolean; message?: string });
  return (
    <form action={action} className="space-y-3">
      <p className="text-sm text-gray-500">
        Choose which slot rotates as a slideshow when it has more than one active banner. When a slot
        is off, its banners simply stack.
      </p>
      <div className="space-y-2">
        <Toggle name="rotateTop" label="Rotate the top banners (above the deals)" defaultChecked={top} />
        <Toggle name="rotateBottom" label="Rotate the after-deals banners" defaultChecked={bottom} />
      </div>
      <div className="flex items-center gap-3">
        <SaveButton />
        {state.ok && state.message && <span className="text-sm text-green-700">{state.message}</span>}
      </div>
    </form>
  );
}
