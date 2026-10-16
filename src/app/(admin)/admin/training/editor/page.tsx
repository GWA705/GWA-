import Link from 'next/link';
import { requireAdminSection } from '@/lib/session';
import { getEffectiveContent, getTrainingOverride, getTrainingAskCount } from '@/lib/training-content';
import { TrainingEditor } from './TrainingEditor';
import { saveTrainingAskCountAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function TrainingEditorPage() {
  await requireAdminSection('training');
  const [{ quiz, rules }, override, askCount] = await Promise.all([
    getEffectiveContent(), getTrainingOverride(), getTrainingAskCount(),
  ]);

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
      <form action={saveTrainingAskCountAction} className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">Questions asked per attempt</h2>
        <p className="mt-1 text-xs text-gray-500">
          There are <strong>{quiz.length}</strong> questions in the pool. Ask a random subset each attempt so reps get a
          different mix (order and answer options are also shuffled). Leave blank or <strong>0</strong> to ask all {quiz.length}.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <input type="number" name="askCount" min={0} max={quiz.length} defaultValue={askCount ?? ''} placeholder={`${quiz.length}`}
            className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <span className="text-sm text-gray-500">of {quiz.length}</span>
          <button type="submit" className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700">Save</button>
          {askCount && <span className="text-xs text-gray-400">Currently asking {Math.min(askCount, quiz.length)} of {quiz.length}.</span>}
        </div>
      </form>

      <TrainingEditor initialQuiz={quiz} initialRules={rules} isCustom={!!override} />
    </div>
  );
}
