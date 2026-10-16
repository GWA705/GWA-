'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminSection } from '@/lib/session';
import { saveTrainingOverride, resetTrainingOverride } from '@/lib/training-content';
import type { QuizQuestion, Rule } from '@/lib/training';

export interface SaveContentResult {
  ok: boolean;
  error?: string;
}

/** Save the admin-edited quiz + rules (the English, authoritative program).
 *  French display text falls back to the built-in translations by question/rule
 *  id; questions you add here appear in English until translated. */
export async function saveTrainingContentAction(
  quiz: QuizQuestion[],
  rules: Rule[],
): Promise<SaveContentResult> {
  await requireAdminSection('training');
  const res = await saveTrainingOverride(quiz, rules);
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath('/admin/training/editor');
  return { ok: true };
}

/** Restore the built-in default quiz + rules. */
export async function resetTrainingContentAction(): Promise<SaveContentResult> {
  await requireAdminSection('training');
  await resetTrainingOverride();
  revalidatePath('/admin/training/editor');
  return { ok: true };
}
