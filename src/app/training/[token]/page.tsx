import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { LANGS, sampleQuiz } from '@/lib/training';
import { getEffectiveContent, getTrainingAskCount, localizedBundle } from '@/lib/training-content';
import { TrainingFlow } from './TrainingFlow';

// Public (no-login) Lead-Generator training. The office shares the link
// /training/<Dealer.trainingToken>; every completion is tagged to that office.

export const dynamic = 'force-dynamic';

const OG_DESC = 'Home Depot in-store training & certification for Georgian Water & Air lead generators.';

export const metadata: Metadata = {
  metadataBase: new URL((process.env.APP_URL || 'https://portal.ghsbarrie.ca').replace(/\/$/, '')),
  title: 'Lead Generator Training — Home Depot Home Services (Georgian Water & Air)',
  description: OG_DESC,
  robots: { index: false, follow: false },
  openGraph: {
    title: 'Lead Generator Training — Georgian Water & Air',
    description: OG_DESC,
    type: 'website',
    images: [{ url: '/training/og-training.jpg', width: 1200, height: 630, alt: 'GWA Lead Generator Training' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lead Generator Training — Georgian Water & Air',
    description: OG_DESC,
    images: ['/training/og-training.jpg'],
  },
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
  // Serve a random subset per visit when an ask-count is configured (anti-coaching);
  // the client additionally shuffles the order of these questions + their options.
  const askCount = await getTrainingAskCount();
  const served = askCount ? { quiz: sampleQuiz(base.quiz, askCount), rules: base.rules } : base;
  const bundles = LANGS.map((l) => localizedBundle(served, l));

  return (
    <main
      className="min-h-screen bg-slate-100 bg-cover bg-fixed bg-center"
      style={{ backgroundImage: "linear-gradient(to bottom, rgba(241,245,249,0.45), rgba(241,245,249,0.25)), url('/training/trainee-hero.webp')" }}
    >
      <TrainingFlow token={params.token} dealerName={dealer.name} bundles={bundles} />
    </main>
  );
}
