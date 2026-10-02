import { describe, it, expect } from 'vitest';
import { parseUsageRecord } from '@/lib/twilioUsage';

describe('parseUsageRecord', () => {
  it('reads count, price and currency from a Twilio usage response', () => {
    const json = {
      usage_records: [
        { category: 'sms', count: '42', price: '1.2345', price_unit: 'usd', usage: '42' },
      ],
    };
    expect(parseUsageRecord(json)).toEqual({ count: 42, price: 1.2345, currency: 'USD' });
  });

  it('handles an empty period (no records) as zeros', () => {
    expect(parseUsageRecord({ usage_records: [] })).toEqual({ count: 0, price: 0, currency: 'USD' });
  });

  it('is defensive about missing/garbage fields', () => {
    expect(parseUsageRecord(null)).toEqual({ count: 0, price: 0, currency: 'USD' });
    expect(parseUsageRecord({ usage_records: [{ price_unit: 'cad' }] })).toEqual({ count: 0, price: 0, currency: 'CAD' });
    expect(parseUsageRecord({ usage_records: [{ count: 'x', price: 'y' }] })).toEqual({ count: 0, price: 0, currency: 'USD' });
  });
});
