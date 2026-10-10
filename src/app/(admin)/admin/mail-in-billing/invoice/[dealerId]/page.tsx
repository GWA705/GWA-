import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdminSection } from '@/lib/session';
import { prisma } from '@/lib/db';
import { monthWindow, recentMonthKeys } from '@/lib/reporting/mailInLeads';
import { getBillingConfig } from '@/lib/billing';
import { InvoiceView } from './InvoiceView';

export const dynamic = 'force-dynamic';

// Georgian Water & Air "from" block — the brand kit's canonical contact block,
// print formatting (dot separators). See docs/BRAND-KIT.md.
const GWA = {
  name: 'Georgian Water & Air',
  legal: '1311852 Ontario Ltd. o/a Georgian Water and Air · HST 764489076RT0001',
  lines: ['10 - 11 King Street', 'Barrie, Ontario  L4N 6B5'],
  contact: ['Toll-Free: 1.866.840.2789 · Tel: 705.812.0320', 'info@georgianwaterandair.ca · georgianwaterandair.ca'],
};

function shortCode(name: string): string {
  const letters = (name || 'OFF').replace(/[^A-Za-z]/g, '').toUpperCase();
  return (letters.slice(0, 3) || 'OFF');
}

export default async function MailInInvoicePage({
  params,
  searchParams,
}: {
  params: { dealerId: string };
  searchParams: { month?: string };
}) {
  await requireAdminSection('mail-in-billing');

  const months = recentMonthKeys(12);
  const monthParam = searchParams.month ?? months[0].value;
  const { from, to } = monthWindow(monthParam);
  const periodLabel = !monthParam || monthParam === 'all' ? 'All time' : months.find((m) => m.value === monthParam)?.label ?? monthParam;

  const dealer = await prisma.dealer.findUnique({
    where: { id: params.dealerId },
    select: {
      id: true, name: true,
      profile: { select: { businessName: true, address: true, phone: true, billingPhone: true, billingEmail: true, supportEmail: true } },
    },
  });
  if (!dealer) notFound();

  // Billable leads for this office in the period: the ones Georgian Water uploaded.
  // No date filter for the all-time view (monthWindow returns nulls then).
  const leads = await prisma.scannedLead.count({
    where: {
      dealerId: dealer.id,
      uploadedByGwa: true,
      ...(from && to ? { createdAt: { gte: from, lt: to } } : {}),
    },
  });

  const cfg = await getBillingConfig();

  const p = dealer.profile;
  // The office address is stored as one free-text block — split it into lines.
  const addrLines = (p?.address || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const billToLines = [
    ...addrLines,
    p?.phone || p?.billingPhone || null,
    p?.billingEmail || p?.supportEmail || null,
  ].filter((x): x is string => !!x);
  const billToName = p?.businessName?.trim() || dealer.name;

  const monthCode = !monthParam || monthParam === 'all' ? 'ALL' : monthParam.replace('-', '');
  const invoiceNo = `GW-${monthCode}-${shortCode(dealer.name)}`;
  const invoiceDate = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <div className="max-w-3xl space-y-4">
      <div className="no-print">
        <Link href={`/admin/mail-in-billing?month=${monthParam}`} className="text-sm text-gray-500 hover:underline">← Back to mail-in billing</Link>
      </div>

      <InvoiceView
        gwa={GWA}
        billTo={{ name: billToName, lines: billToLines }}
        invoiceNo={invoiceNo}
        invoiceDate={invoiceDate}
        periodLabel={periodLabel}
        leads={leads}
        rates={{ leadRate: cfg.leadRate, envelopeRate: cfg.envelopeRate, hstPercent: cfg.hstPercent }}
      />
    </div>
  );
}
