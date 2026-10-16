import Link from 'next/link';
import { requireAdminSection } from '@/lib/session';
import { getEffectiveContent, getTrainingOverride } from '@/lib/training-content';
import { TrainingEditor } from './TrainingEditor';

export const dynamic = 'force-dynamic';

export default async function TrainingEditorPage() {
  await requireAdminSection('training');
  const [{ quiz, rules }, override] = await Promise.all([getEffectiveContent(), getTrainingOverride()]);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link href="/admin/training" className="text-sm text-gray-500 hover:underline">← Back to training records</Link>
        <h1 className="mt-2 text-xl font-semibold text-gray-900">Edit the quiz &amp; rules</h1>
        <p className="mt-1 text-sm text-gray-500">
          Change the questions trainees answer and the rules they sign off on. Changes apply to every office’s training
          link right away. Certificates already earned keep the exact questions the trainee saw.
        </p>
        <p className="mt-1 text-xs text-gray-400">
          {override ? 'You’re using a custom (edited) program.' : 'You’re using the built-in default program.'} The French
          version uses the built-in translations; questions you add appear in English until translated.
        </p>
      </div>
      <TrainingEditor initialQuiz={quiz} initialRules={rules} isCustom={!!override} />
    </div>
  );
}
