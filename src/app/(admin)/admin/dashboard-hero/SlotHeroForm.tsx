'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { uploadSlotHeroAction } from '@/app/(admin)/actions';

type State = { error?: string; ok?: boolean };

function Btn({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-secondary w-full text-xs" disabled={pending}>
      {pending ? '…' : label}
    </button>
  );
}

export function SlotHeroForm({ slotHour, hasImage }: { slotHour: number; hasImage: boolean }) {
  const [state, action] = useFormState(uploadSlotHeroAction.bind(null, slotHour), {} as State);
  return (
    <form action={action} className="flex flex-col gap-1">
      <input
        type="file"
        name="image"
        accept=".jpg,.jpeg,.png,.webp,.gif,image/gif"
        className="block w-full text-xs text-gray-600 file:mr-2 file:rounded file:border-0 file:bg-gray-100 file:px-2 file:py-1 file:text-xs"
      />
      <Btn label={hasImage ? 'Replace image' : 'Upload image'} />
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
