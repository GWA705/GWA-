import { describe, it, expect } from 'vitest';
import { parseContactsCsv, extractEmails, resolveStoreRecipients, parseCsv } from '@/lib/hdStoreContacts';

// A slice of the real GWA contacts sheet, including a multiline quoted cell and
// the National row at the end.
const CSV = [
  ',Store contact,ISM,DISTRIBUTOR,OFFICE MANAGER',
  '7024 - Barrie,"asm_store_7024@homedepot.com',
  'holly_7024@homedepot.com',
  'sm_store_7024@homedepot.com",andre_a_henry_cotnam@homedepot.com,JJ@ghsbarrie.ca,sean@ghsbarrie.ca',
  '7032 - Kelowna,"asm_store_7032@homedepot.com',
  'ryan_m_healy@homedepot.com",lesley_a_owen@homedepot.com,"NICK H',
  'simplewaterservices@gmail.com","PATTY CA$H',
  'purchaseoffpatrick@gmail.com"',
  'National Sales Update ,"sean@georgianwaterandair.ca, STEVE_MULVIHILL@homedepot.com, jj@georgianwaterandair.ca",,,',
].join('\n');

describe('HD store contacts CSV import', () => {
  const parsed = parseContactsCsv(CSV);

  it('parses each store with its number, name, and district', () => {
    const barrie = parsed.stores.find((s) => s.storeNumber === '7024')!;
    expect(barrie.storeName).toBe('Barrie');
    expect(barrie.district).toBe('Central Ontario');
    expect(barrie.ism).toBe('andre_a_henry_cotnam@homedepot.com');
    expect(barrie.distributor).toBe('JJ@ghsbarrie.ca');
    expect(barrie.officeManager).toBe('sean@ghsbarrie.ca');
    const kelowna = parsed.stores.find((s) => s.storeNumber === '7032')!;
    expect(kelowna.district).toBe('BC Interior');
  });

  it('keeps multiline store-contact blocks intact', () => {
    const barrie = parsed.stores.find((s) => s.storeNumber === '7024')!;
    expect(barrie.storeContacts).toContain('asm_store_7024@homedepot.com');
    expect(barrie.storeContacts).toContain('sm_store_7024@homedepot.com');
  });

  it('pulls the national recipient list off its own row', () => {
    expect(extractEmails(parsed.national)).toEqual([
      'sean@georgianwaterandair.ca', 'steve_mulvihill@homedepot.com', 'jj@georgianwaterandair.ca',
    ]);
  });

  it('resolves To = store+distributor+officeManager, Cc = ISM (deduped)', () => {
    const barrie = parsed.stores.find((s) => s.storeNumber === '7024')!;
    const { to, cc } = resolveStoreRecipients(barrie);
    expect(to).toContain('jj@ghsbarrie.ca');       // distributor
    expect(to).toContain('sean@ghsbarrie.ca');     // office manager
    expect(to).toContain('sm_store_7024@homedepot.com'); // store contact
    expect(cc).toEqual(['andre_a_henry_cotnam@homedepot.com']); // ISM
  });

  it('parseCsv handles quoted commas and embedded newlines', () => {
    const rows = parseCsv('a,"b1\nb2","c,still c"\n');
    expect(rows[0]).toEqual(['a', 'b1\nb2', 'c,still c']);
  });
});
