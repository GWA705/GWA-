import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { LANGS } from '@/lib/training';
import { getEffectiveContent, localizedBundle } from '@/lib/training-content';
import { TrainingFlow } from './TrainingFlow';

// Public (no-login) Lead-Generator training. The office shares the link
// /training/<Dealer.trainingToken>; every completion is tagged to that office.

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Lead Generator Training — Home Depot Home Services (Georgian Water & Air)',
  description: 'In-store training and certification for Georgian Water & Air lead generators at The Home Depot.',
  robots: { index: false, follow: false },
};

export default async function TrainingPage({ params }: { params: { token: string } }) {
  const dealer = await prisma.dealer.findUnique({
    where: { trainingToken: params.token },
    select: { name: true, active: true },
  });

  if (!dealer || !dealer.active) {
    return (
      <main className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-xl font-bold text-gray-900">Training link not found</h1>
        <p className="mt-2 text-sm text-gray-500">
          This training link isn’t valid or has been turned off. Please ask your office for a current link.
        </p>
      </main>
    );
  }

  // The effective (possibly admin-edited) program, rendered in each language.
  // Quiz/rules keep their ids + correct answers across languages, so scoring is
  // identical whichever one the trainee picks.
  const base = await getEffectiveContent();
  const bundles = LANGS.map((l) => localizedBundle(base, l));

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-white">
      <TrainingFlow token={params.token} dealerName={dealer.name} bundles={bundles} />
    </main>
  );
}
