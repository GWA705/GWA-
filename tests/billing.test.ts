import { describe, it, expect } from 'vitest';
import { computeInvoice, money } from '@/lib/billingMath';

describe('computeInvoice', () => {
  it('bills $5/lead + $2/envelope with envelopes defaulting to one per lead', () => {
    const a = computeInvoice(107, 107, { leadRate: 5, envelopeRate: 2, hstPercent: 0 });
    expect(a.leadTotal).toBe(535);
    expect(a.envelopeTotal).toBe(214);
    expect(a.subtotal).toBe(749);
    expect(a.hst).toBe(0);
    expect(a.total).toBe(749);
  });

  it('adds HST when a rate is set', () => {
    const a = computeInvoice(10, 10, { leadRate: 5, envelopeRate: 2, hstPercent: 13 });
    expect(a.subtotal).toBe(70);
    expect(a.hst).toBe(9.1);
    expect(a.total).toBe(79.1);
  });

  it('honours an adjusted envelope count independent of lead count', () => {
    const a = computeInvoice(100, 4, { leadRate: 5, envelopeRate: 2, hstPercent: 0 });
    expect(a.leadTotal).toBe(500);
    expect(a.envelopeTotal).toBe(8);
    expect(a.total).toBe(508);
  });

  it('respects adjustable rates', () => {
    const a = computeInvoice(10, 10, { leadRate: 7.5, envelopeRate: 1.25, hstPercent: 0 });
    expect(a.leadTotal).toBe(75);
    expect(a.envelopeTotal).toBe(12.5);
    expect(a.total).toBe(87.5);
  });

  it('formats money to two decimals', () => {
    expect(money(749)).toBe('$749.00');
    expect(money(1234.5)).toBe('$1,234.50');
  });
});
