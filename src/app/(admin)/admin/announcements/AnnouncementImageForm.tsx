'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { setAnnouncementImageAction } from '@/app/(admin)/actions';

type State = { error?: string; ok?: boolean };

function Btn({ label, danger, name, value }: { label: string; danger?: boolean; name?: string; value?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      className={`${danger ? 'btn-danger' : 'btn-secondary'} w-full text-xs`}
      disabled={pending}
    >
      {pending ? '…' : label}
    </button>
  );
}

export function AnnouncementImageForm({ id, hasImage }: { id: string; hasImage: boolean }) {
  const [state, action] = useFormState(setAnnouncementImageAction.bind(null, id), {} as State);
  return (
    <form action={action} className="flex flex-col gap-1">
      <input
        type="file"
        name="image"
        accept=".jpg,.jpeg,.png,.webp"
        className="block w-40 text-xs text-gray-600 file:mr-2 file:rounded file:border-0 file:bg-gray-100 file:px-2 file:py-1 file:text-xs"
      />
      <Btn label={hasImage ? 'Replace image' : 'Add image'} />
      {hasImage && <Btn label="Remove image" danger name="remove" value="1" />}
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
