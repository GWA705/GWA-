import { requireGiftCardAccess } from '@/lib/giftCardAccess';
import { SectionHero } from '@/components/SectionHero';
import { loadGiftCardQueue } from '@/lib/giftCardQueueData';
import { queryGiftCards, monthLabel } from '@/lib/giftCardHistory';
import { GiftCardQueue } from '@/app/(admin)/admin/gift-cards/GiftCardQueue';
import { StaffFlaggedGiftCards } from '@/app/(admin)/admin/gift-cards/StaffFlaggedGiftCards';
import { GiftCardHistory, type HistoryRow } from '@/app/(admin)/admin/gift-cards/GiftCardHistory';

export const dynamic = 'force-dynamic';

const stamp = (d: Date) =>
  d.toLocaleString('en-CA', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default async function StaffGiftCardsPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; month?: string; sort?: string; perPage?: string; page?: string };
}) {
  await requireGiftCardAccess();
  const [{ pending, flagged }, history] = await Promise.all([
    loadGiftCardQueue(),
    queryGiftCards({ ...searchParams }),
  ]);

  const rows: HistoryRow[] = history.rows.map((r) => ({
    id: r.id,
    customerName: r.customerName,
    customerEmail: r.customerEmail,
    customerPhone: r.customerPhone,
    dealerName: (r as { dealer?: { name: string | null } | null }).dealer?.name ?? '—',
    amount: Number(r.amount),
    status: r.status,
    at: stamp(r.createdAt),
  }));
  const months = history.months.map((m) => ({ value: m, label: monthLabel(m) }));

  return (
    <div className="space-y-6">
      <SectionHero
        eyebrow="Rewards"
        title="Water-test gift cards"
        subtitle="Dealers submit a customer + card amount for each completed water test. Copy the selected emails (or CSV) into Guusto, send, then mark them sent — that stamps a dated receipt back to the dealer."
      />

      <StaffFlaggedGiftCards flagged={flagged} />

      <GiftCardQueue pending={pending} />

      <GiftCardHistory
        basePath="/staff/gift-cards"
        rows={rows}
        months={months}
        q={history.q}
        status={history.status}
        month={history.month}
        sort={history.sort}
        perPage={history.perPage}
        page={history.page}
        pageCount={history.pageCount}
        firstShown={history.firstShown}
        lastShown={history.lastShown}
        total={history.total}
      />
    </div>
  );
}
