'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminSection } from '@/lib/session';
import { setTrainingEnabledOffices } from '@/lib/training-content';

/** Save which offices can see + use the Lead Gen Training module. No offices
 *  ticked = open to every office. */
export async function saveTrainingOfficesAction(formData: FormData): Promise<void> {
  await requireAdminSection('training');
  const ids = formData.getAll('offices').map((v) => String(v)).filter(Boolean);
  await setTrainingEnabledOffices(ids);
  revalidatePath('/admin/training');
  revalidatePath('/dealer', 'layout');
}
