'use client';

import { useEffect, useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { saveCategoryAction, type CategoryActionState } from './actions';

interface Category {
  id: string;
  name: string;
  sortOrder: number;
}

const initial: CategoryActionState = {};

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={isEdit ? 'btn-secondary text-xs' : 'btn-primary'} disabled={pending}>
      {pending ? 'Saving…' : isEdit ? 'Save' : 'Add category'}
    </button>
  );
}

// Handles both adding a new category and renaming/reordering an existing one.
export function CategoryForm({ category }: { category?: Category }) {
  const [state, action] = useFormState(saveCategoryAction, initial);
  const isEdit = !!category;
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the "add" form after a successful add so it's ready for the next one.
  useEffect(() => {
    if (state.ok && !isEdit) formRef.current?.reset();
  }, [state, isEdit]);

  return (
    <form ref={formRef} action={action} className="flex flex-wrap items-end gap-2">
      {category && <input type="hidden" name="id" value={category.id} />}
      <div className="min-w-[10rem] flex-1">
        {!isEdit && <label className="label">New category</label>}
        <input name="name" defaultValue={category?.name ?? ''} placeholder="Category name" className="input" />
      </div>
      <div className="w-20">
        {!isEdit && <label className="label">Sort</label>}
        <input name="sortOrder" type="number" defaultValue={category?.sortOrder ?? 0} className="input" title="Lower numbers show first" />
      </div>
      <SubmitButton isEdit={isEdit} />
      {isEdit && state.ok && <span className="text-xs text-green-600">✓</span>}
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
