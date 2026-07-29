'use client';

import { useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { createAnnouncementAction, type ActionState } from '@/app/(admin)/actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Posting…' : 'Post announcement'}
    </button>
  );
}

export function AnnouncementForm() {
  const [state, action] = useFormState(createAnnouncementAction, {} as ActionState);
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      action={async (fd) => {
        await action(fd);
        ref.current?.reset();
      }}
      className="space-y-4"
    >
      {state.error && <div className="rounded-md bg-red-50 p-2 text-sm text-red-700">{state.error}</div>}
      {state.ok && <div className="rounded-md bg-green-50 p-2 text-sm text-green-700">Announcement posted.</div>}

      <div>
        <label className="label" htmlFor="title">Title <span className="font-normal text-gray-400">(optional)</span></label>
        <input id="title" name="title" className="input" placeholder="e.g. New HD promotion this month" />
      </div>
      <div>
        <label className="label" htmlFor="body">News / message <span className="font-normal text-gray-400">(optional if a banner image is added)</span></label>
        <textarea id="body" name="body" rows={3} className="input" placeholder="Write the announcement dealers should see…" />
      </div>
      <div>
        <label className="label" htmlFor="linkUrl">Link <span className="font-normal text-gray-400">(optional)</span></label>
        <input id="linkUrl" name="linkUrl" className="input" placeholder="https://…" />
      </div>
      <div>
        <label className="label" htmlFor="image">Banner image <span className="font-normal text-gray-400">(optional — JPG/PNG/WEBP)</span></label>
        <input id="image" name="image" type="file" accept=".jpg,.jpeg,.png,.webp" className="block w-full text-sm text-gray-600 file:mr-3 file:rounded file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100" />
      </div>
      <SubmitButton />
    </form>
  );
}
