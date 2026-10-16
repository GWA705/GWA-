import {
  QUIZ, RULES, localizeQuiz, localizeRules,
  type QuizQuestion, type Rule, type Lang,
} from '@/lib/training';

export interface CertRecord {
  traineeName: string;
  traineeEmail: string;
  traineePhone: string;
  traineeAddress: string | null;
  traineeCity?: string | null;
  traineePostal?: string | null;
  startDate?: string | null;
  score: number;
  passed: boolean;
  answers: unknown;
  acknowledged: unknown;
  signatureName: string;
  contentVersion: string;
  contentSnapshot?: unknown; // { quiz, rules } the trainee actually saw
  language?: string | null;
  ipAddress: string | null;
  createdAt: Date;
}

// The exact quiz + rules this certificate should render against: the snapshot
// stored at completion when present (so a later admin edit never rewrites
// history), otherwise the current built-in defaults for older records. Rendered
// in the language the trainee completed in.
function effectiveContent(cert: CertRecord): { quiz: QuizQuestion[]; rules: Rule[] } {
  const lang: Lang = cert.language === 'fr' ? 'fr' : 'en';
  const snap = cert.contentSnapshot as { quiz?: QuizQuestion[]; rules?: Rule[] } | null | undefined;
  const quiz = Array.isArray(snap?.quiz) && snap!.quiz!.length ? snap!.quiz! : QUIZ;
  const rules = Array.isArray(snap?.rules) && snap!.rules!.length ? snap!.rules! : RULES;
  return { quiz: localizeQuiz(quiz, lang), rules: localizeRules(rules, lang) };
}

/** Printable certificate record for a completed training. Pure render; the page
 *  supplies the office name and the Print button. Used by the dealer and admin
 *  certificate pages. */
export function TrainingCertificateView({ cert, dealerName }: { cert: CertRecord; dealerName: string }) {
  const answers = (cert.answers as Record<string, number>) || {};
  const acked = new Set((cert.acknowledged as string[]) || []);
  const { quiz, rules } = effectiveContent(cert);
  const langLabel = cert.language === 'fr' ? 'Français' : 'English';
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm print:border-gray-300 print:shadow-none">
      <div className="text-center">
        <div className="text-sm font-semibold text-gray-900">Home Depot Home Services</div>
        <div className="text-xs text-gray-500">serviced by Georgian Water &amp; Air</div>
        <h1 className="mt-3 text-2xl font-bold text-gray-900">Training Certificate</h1>
        <span className={`mt-2 inline-block rounded-full px-3 py-0.5 text-xs font-bold ${cert.passed ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
          {cert.passed ? 'Passed' : 'Incomplete'} · Score {cert.score}%
        </span>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
        <div><dt className="text-gray-400">Name</dt><dd className="font-medium text-gray-900">{cert.traineeName}</dd></div>
        <div><dt className="text-gray-400">Office / dealer</dt><dd className="font-medium text-gray-900">{dealerName}</dd></div>
        <div><dt className="text-gray-400">Email</dt><dd className="font-medium text-gray-900 break-words">{cert.traineeEmail}</dd></div>
        <div><dt className="text-gray-400">Phone</dt><dd className="font-medium text-gray-900">{cert.traineePhone}</dd></div>
        {(cert.traineeAddress || cert.traineeCity || cert.traineePostal) && (
          <div className="col-span-2"><dt className="text-gray-400">Address</dt>
            <dd className="font-medium text-gray-900">{[cert.traineeAddress, cert.traineeCity, cert.traineePostal].filter(Boolean).join(', ')}</dd></div>
        )}
        {cert.startDate && <div><dt className="text-gray-400">Start date</dt><dd className="font-medium text-gray-900">{cert.startDate}</dd></div>}
        <div><dt className="text-gray-400">Completed</dt><dd className="font-medium text-gray-900">{cert.createdAt.toLocaleString('en-CA')}</dd></div>
        <div><dt className="text-gray-400">Program version</dt><dd className="font-medium text-gray-900">{cert.contentVersion}</dd></div>
        <div><dt className="text-gray-400">Language</dt><dd className="font-medium text-gray-900">{langLabel}</dd></div>
      </dl>

      <div className="mt-6 border-t border-gray-200 pt-4">
        <h2 className="text-sm font-semibold text-gray-900">Rules acknowledged</h2>
        <ul className="mt-2 space-y-1.5 text-sm">
          {rules.map((r) => (
            <li key={r.id} className="flex gap-2">
              <span className={acked.has(r.id) ? 'text-green-600' : 'text-gray-300'}>{acked.has(r.id) ? '✔' : '✕'}</span>
              <span className="text-gray-700">{r.text}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 border-t border-gray-200 pt-4">
        <h2 className="text-sm font-semibold text-gray-900">Quiz answers</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {quiz.map((q, qi) => {
            const a = answers[q.id];
            const right = a === q.correct;
            return (
              <li key={q.id}>
                <p className="font-medium text-gray-800">{qi + 1}. {q.q}</p>
                <p className={right ? 'text-green-700' : 'text-red-700'}>
                  {right ? '✔' : '✕'} {typeof a === 'number' ? q.options[a] : '— (no answer)'}
                  {!right && typeof q.correct === 'number' && <span className="text-gray-500"> · correct: {q.options[q.correct]}</span>}
                </p>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-6 border-t border-gray-200 pt-4">
        <p className="text-sm text-gray-700">Digitally signed by <span className="font-[cursive] text-lg text-gray-900">{cert.signatureName}</span></p>
        <p className="mt-1 text-xs text-gray-400">
          Recorded {cert.createdAt.toLocaleString('en-CA')}{cert.ipAddress ? ` · IP ${cert.ipAddress}` : ''}. This record is retained for Home Depot compliance.
        </p>
      </div>
    </div>
  );
}
