import { describe, it, expect } from 'vitest';
import { fillHdWaiver } from '../src/lib/hdWaiver';

describe('fillHdWaiver', () => {
  it('stamps the fields and returns a valid PDF', async () => {
    const bytes = await fillHdWaiver({
      storeNumber: '7137',
      customerName: 'Jane Doe',
      jobSiteAddress: '12 Lake St, Orillia, ON L3V 1A1',
      installerCompany: 'Georgian Water & Air',
    });
    expect(bytes.length).toBeGreaterThan(1000);
    expect(Buffer.from(bytes.slice(0, 5)).toString('latin1')).toBe('%PDF-');
  });

  it('handles missing fields without throwing', async () => {
    const bytes = await fillHdWaiver({});
    expect(bytes.length).toBeGreaterThan(1000);
    expect(Buffer.from(bytes.slice(0, 5)).toString('latin1')).toBe('%PDF-');
  });
});
