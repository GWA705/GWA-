import Link from 'next/link';
import { randomBytes } from 'crypto';
import { requireDealerAccess } from '@/lib/session';
import { prisma } from '@/lib/db';
import { TrainingLinkCard } from './TrainingLinkCard';

export const dynamic = 'force-dynamic';

function baseUrl() {
  return (process.env.APP_URL || 'https://portal.ghsbarrie.ca').replace(/\/$/, '');
}

export default async function DealerTrainingPage() {
  const user = await requireDealerAccess();
  const dealerId = user.dealerId as string;

  // Ensure this office has a training link token (lazily created, idempotent).
  let dealer = await prisma.dealer.findUnique({ where: { id: dealerId }, select: { name: true, trainingToken: true } });
  if (dealer && !dealer.trainingToken) {
    const token = randomBytes(24).toString('base64url');
    await prisma.dealer.update({ where: { id: dealerId }, data: { trainingToken: token } });
    dealer = { ...dealer, trainingToken: token };
  }
  const link = dealer?.trainingToken ? `${baseUrl()}/training/${dealer.trainingToken}` : '';

  const certs = await prisma.trainingCertification.findMany({
    where: { dealerId },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: { id: true, traineeName: true, traineeEmail: true, score: true, passed: true, createdAt: true },
  });

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Lead Generator Training</h1>
        <p className="mt-1 text-sm text-gray-500">
          Send a new lead generator your training link. They enter their details, learn the Home Depot in-store basics,
          pass a quiz, and sign off on the rules. Every completion is recorded here for your office and Home Depot.
        </p>
      </div>

      {link ? <TrainingLinkCard url={link} /> : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Couldn’t create a training link for this office. Please contact GWA.</div>
      )}

      <div className="card p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Completions</h2>
          <span className="text-xs text-gray-500">{certs.length} total</span>
        </div>
        {certs.length === 0 ? (
          <p className="text-sm text-gray-500">No one has completed the training yet. Share your link above to get started.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                  <th className="py-1.5 pr-3">Name</th>
                  <th className="py-1.5 pr-3">Email</th>
                  <th className="py-1.5 pr-3">Score</th>
                  <th className="py-1.5 pr-3">Result</th>
                  <th className="py-1.5 pr-3">Date</th>
                  <th className="py-1.5">Certificate</th>
                </tr>
              </thead>
              <tbody>
                {certs.map((c) => (
                  <tr key={c.id} className="border-b border-gray-50">
                    <td className="py-1.5 pr-3 font-medium text-gray-800">{c.traineeName}</td>
                    <td className="py-1.5 pr-3 text-gray-500">{c.traineeEmail}</td>
                    <td className="py-1.5 pr-3 tabular-nums text-gray-700">{c.score}%</td>
                    <td className="py-1.5 pr-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${c.passed ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>{c.passed ? 'Passed' : 'Incomplete'}</span>
                    </td>
                    <td className="py-1.5 pr-3 text-xs text-gray-400">{c.createdAt.toLocaleDateString('en-CA')}</td>
                    <td className="py-1.5"><Link href={`/dealer/training/${c.id}`} className="text-xs font-medium text-brand-600 hover:underline">View</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
