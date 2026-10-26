import { describe, it, expect } from 'vitest';
import { buildRemittanceReportPdf, remittanceReportRecipients } from '@/lib/remittanceReport';

describe('remittance matched report', () => {
  it('defaults to the office team, env-overridable', () => {
    const def = remittanceReportRecipients();
    expect(def).toEqual(['Vanita@ghsbarrie.ca', 'jj@ghsbarrie.ca', 'Alex@ghsbarrie.ca', 'Sean@ghsbarrie.ca']);
  });

  it('renders a valid PDF from matched rows', async () => {
    const rows = [
      { invoiceDate: new Date('2026-10-23'), hdId: '701812650', customer: 'Najia Yan', office: 'Barrie', store: '7135', amount: 338.81, statusLabel: 'FUNDED' },
      { invoiceDate: new Date('2026-10-23'), hdId: '800256701', customer: 'Felicia Foong', office: 'Oasis', store: '7119', amount: 8289.69, statusLabel: 'FUNDED' },
      { invoiceDate: new Date('2026-10-16'), hdId: 'SEPT26LEADFEES31', customer: 'Lead fee', office: '—', store: '—', amount: -490, statusLabel: 'FEE' },
    ];
    const bytes = await buildRemittanceReportPdf(rows, { documentNumber: '2000160840', paymentDate: new Date('2026-10-27'), totalNet: 8138.5, lineCount: 3 });
    expect(bytes.length).toBeGreaterThan(1000);
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe('%PDF-');
  });
});
