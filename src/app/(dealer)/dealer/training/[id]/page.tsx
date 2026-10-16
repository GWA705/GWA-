import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireDealerAccess } from '@/lib/session';
import { prisma } from '@/lib/db';
import { QUIZ, RULES } from '@/lib/training';

export const dynamic = 'force-dynamic';

export default async function CertificatePage({ params }: { params: { id: string } }) {
  const user = await requireDealerAccess();
  const cert = await prisma.trainingCertification.findUnique({ where: { id: params.id } });
  // Scope: a dealer can only view their own office's certificates.
  if (!cert || cert.dealerId !== user.dealerId) notFound();

  const dealer = await prisma.dealer.findUnique({ where: { id: cert.dealerId }, select: { name: true } });
  const answers = (cert.answers as Record<string, number>) || {};
  const acked = new Set((cert.acknowledged as string[]) || []);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/dealer/training" className="text-sm text-gray-500 hover:underline">← Back to training</Link>
        <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 print:hidden" data-print>Print / save PDF</button>
      </div>

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
          <div><dt className="text-gray-400">Office / dealer</dt><dd className="font-medium text-gray-900">{dealer?.name ?? '—'}</dd></div>
          <div><dt className="text-gray-400">Email</dt><dd className="font-medium text-gray-900 break-words">{cert.traineeEmail}</dd></div>
          <div><dt className="text-gray-400">Phone</dt><dd className="font-medium text-gray-900">{cert.traineePhone}</dd></div>
          {cert.traineeAddress && <div className="col-span-2"><dt className="text-gray-400">Address</dt><dd className="font-medium text-gray-900">{cert.traineeAddress}</dd></div>}
          <div><dt className="text-gray-400">Completed</dt><dd className="font-medium text-gray-900">{cert.createdAt.toLocaleString('en-CA')}</dd></div>
          <div><dt className="text-gray-400">Program version</dt><dd className="font-medium text-gray-900">{cert.contentVersion}</dd></div>
        </dl>

        <div className="mt-6 border-t border-gray-200 pt-4">
          <h2 className="text-sm font-semibold text-gray-900">Rules acknowledged</h2>
          <ul className="mt-2 space-y-1.5 text-sm">
            {RULES.map((r) => (
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
            {QUIZ.map((q, qi) => {
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
      <PrintScript />
    </div>
  );
}

// Tiny inline client handler so the Print button works without a separate file.
function PrintScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `document.querySelectorAll('[data-print]').forEach(function(b){b.addEventListener('click',function(){window.print();});});`,
      }}
    />
  );
}
