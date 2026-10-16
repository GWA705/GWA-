import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdminSection } from '@/lib/session';
import { prisma } from '@/lib/db';
import { TrainingCertificateView } from '@/components/TrainingCertificateView';

export const dynamic = 'force-dynamic';

export default async function AdminCertificatePage({ params }: { params: { id: string } }) {
  await requireAdminSection('training');
  const cert = await prisma.trainingCertification.findUnique({ where: { id: params.id } });
  if (!cert) notFound();
  const dealer = await prisma.dealer.findUnique({ where: { id: cert.dealerId }, select: { name: true } });

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/admin/training" className="text-sm text-gray-500 hover:underline">← Back to training records</Link>
        <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700" data-print>Print / save PDF</button>
      </div>
      <TrainingCertificateView cert={cert} dealerName={dealer?.name ?? '—'} />
      <script dangerouslySetInnerHTML={{ __html: `document.querySelectorAll('[data-print]').forEach(function(b){b.addEventListener('click',function(){window.print();});});` }} />
    </div>
  );
}
