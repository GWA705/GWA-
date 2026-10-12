import { requireDealerAccess } from '@/lib/session';
import { prisma } from '@/lib/db';
import { SectionHero } from '@/components/SectionHero';
import { BUSINESS_DOC_TYPES, OTHER_DOC_TYPE } from '@/lib/constants';
import { docStatus, statusLabel } from '@/lib/dealerDocs';
import { DocumentManager, type DocVM, type SlotVM } from './DocumentManager';
import { getT } from '@/i18n/server';

export const dynamic = 'force-dynamic';

const iso = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const stamp = (d: Date) => new Date(d).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });

export default async function DealerDocumentsPage() {
  const t = getT();
  const session = await requireDealerAccess();
  const dealerId = session.dealerId ?? null;

  const docs = dealerId
    ? await prisma.dealerDocument.findMany({ where: { dealerId }, orderBy: { createdAt: 'desc' } })
    : [];

  const now = new Date();
  const toVM = (d: (typeof docs)[number]): DocVM => {
    const { status, daysLeft } = docStatus(d.expiryDate, now);
    return {
      id: d.id,
      type: d.type,
      label: d.label,
      fileName: d.fileName,
      expiryDate: iso(d.expiryDate),
      accountNumber: d.accountNumber,
      status,
      daysLeft,
      statusText: statusLabel(status, daysLeft),
      uploadedAt: stamp(d.createdAt),
      autoExtracted: d.autoExtracted,
    };
  };

  // One current row per fixed type (most recent), plus everything else as "other".
  const slots: SlotVM[] = BUSINESS_DOC_TYPES.map((t) => {
    const current = docs.find((d) => d.type === t.key) ?? null;
    return {
      key: t.key,
      label: t.label,
      description: t.description,
      hasAccountNumber: t.hasAccountNumber,
      accountLabel: t.accountLabel,
      current: current ? toVM(current) : null,
    };
  });
  const others: DocVM[] = docs.filter((d) => d.type === OTHER_DOC_TYPE).map(toVM);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <SectionHero
        title={t('dlrDocs.heroTitle')}
        subtitle={t('dlrDocs.heroSubtitle')}
        bgImage="/support-agent.webp"
      />
      <DocumentManager slots={slots} others={others} />
    </div>
  );
}
