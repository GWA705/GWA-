'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { createSpecialHeroAction } from '@/app/(admin)/actions';

type State = { error?: string; ok?: boolean };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary text-sm" disabled={pending}>
      {pending ? 'Saving…' : 'Add special occasion'}
    </button>
  );
}

function Lab({ children }: { children: React.ReactNode }) {
  return <span className="mb-1 block text-xs font-medium text-gray-600">{children}</span>;
}

export function SpecialHeroForm() {
  const [state, action] = useFormState(createSpecialHeroAction, {} as State);
  return (
    <form action={action} className="space-y-3" key={state.ok ? 'done' : 'form'}>
      <label className="block">
        <Lab>Image or GIF</Lab>
        <input
          type="file"
          name="image"
          required
          accept=".jpg,.jpeg,.png,.webp,.gif,image/gif"
          className="block w-full text-xs text-gray-600 file:mr-2 file:rounded file:border-0 file:bg-gray-100 file:px-2 file:py-1 file:text-xs"
        />
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <Lab>Name</Lab>
          <input name="name" className="input" placeholder="Halloween" />
        </label>
        <div>
          <Lab>Shows</Lab>
          <div className="flex gap-4 pt-1.5 text-sm text-gray-700">
            <label className="flex items-center gap-1.5"><input type="radio" name="scope" value="ALL" defaultChecked /> Whole day</label>
            <label className="flex items-center gap-1.5"><input type="radio" name="scope" value="NIGHT" /> Nights only</label>
          </div>
        </div>
        <label className="block">
          <Lab>Start date (optional)</Lab>
          <input type="date" name="startsOn" className="input" />
        </label>
        <label className="block">
          <Lab>End date (optional)</Lab>
          <input type="date" name="endsOn" className="input" />
        </label>
      </div>
      <p className="text-[11px] text-gray-500">
        Set both dates to schedule a window — it turns on and off on its own, then the dashboard goes back to the normal
        time-of-day heroes. Leave both blank to run it <b>until you turn it off</b>.
      </p>
      <div className="flex items-center gap-3">
        <Submit />
        {state.error && <span className="text-xs text-red-600">{state.error}</span>}
        {state.ok && <span className="text-xs text-green-700">Added. It turns on and off on its own.</span>}
      </div>
    </form>
  );
}
