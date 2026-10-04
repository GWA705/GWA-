'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { createLoginThemeAction } from '@/app/(admin)/actions';

type State = { error?: string; ok?: boolean };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary text-sm" disabled={pending}>
      {pending ? 'Saving…' : 'Add login look'}
    </button>
  );
}

function Lab({ children }: { children: React.ReactNode }) {
  return <span className="mb-1 block text-xs font-medium text-gray-600">{children}</span>;
}

export function LoginThemeForm() {
  const [state, action] = useFormState(createLoginThemeAction, {} as State);
  return (
    <form action={action} className="space-y-3" key={state.ok ? 'done' : 'form'}>
      <label className="block">
        <Lab>Background image or GIF</Lab>
        <input
          type="file"
          name="image"
          required
          accept=".jpg,.jpeg,.png,.webp,.gif,image/gif"
          className="block w-full text-xs text-gray-600 file:mr-2 file:rounded file:border-0 file:bg-gray-100 file:px-2 file:py-1 file:text-xs"
        />
        <span className="mt-1 block text-[11px] text-gray-400">A wide landscape image works best (it fills the whole screen). Max 15 MB.</span>
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <Lab>Name</Lab>
          <input name="name" className="input" placeholder="Christmas" />
        </label>
        <label className="block">
          <Lab>Accent colour (optional)</Lab>
          <input type="color" name="accentColor" defaultValue="#ff7416" className="h-[38px] w-full cursor-pointer rounded border border-gray-200 bg-white p-1" />
          <span className="mt-1 block text-[11px] text-gray-400">Colours the title word, the sign-in button and the field focus ring.</span>
        </label>
        <label className="block">
          <Lab>Start date (optional)</Lab>
          <input type="date" name="startsOn" className="input" />
        </label>
        <label className="block">
          <Lab>End date (optional)</Lab>
          <input type="date" name="endsOn" className="input" />
        </label>
      </div>
      <p className="text-[11px] text-gray-400">
        Set both dates to schedule it for an occasion — it turns on and off on its own. Leave both blank to switch it on now and keep it until you turn it off.
      </p>
      <div className="flex items-center gap-3">
        <Submit />
        {state.error && <span className="text-xs text-red-600">{state.error}</span>}
        {state.ok && <span className="text-xs text-green-700">Added.</span>}
      </div>
    </form>
  );
}
