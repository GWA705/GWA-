import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireDealerAccess } from '@/lib/session';
import { prisma } from '@/lib/db';
import { TrainingCertificateView } from '@/components/TrainingCertificateView';

export const dynamic = 'force-dynamic';

export default async function CertificatePage({ params }: { params: { id: string } }) {
  const user = await requireDealerAccess();
  const cert = await prisma.trainingCertification.findUnique({ where: { id: params.id } });
  // Scope: a dealer can only view their own office's certificates.
  if (!cert || cert.dealerId !== user.dealerId) notFound();
  const dealer = await prisma.dealer.findUnique({ where: { id: cert.dealerId }, select: { name: true } });

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/dealer/training" className="text-sm text-gray-500 hover:underline">← Back to training</Link>
        <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700" data-print>Print / save PDF</button>
      </div>
      <TrainingCertificateView cert={cert} dealerName={dealer?.name ?? '—'} />
      <script dangerouslySetInnerHTML={{ __html: `document.querySelectorAll('[data-print]').forEach(function(b){b.addEventListener('click',function(){window.print();});});` }} />
    </div>
  );
}
