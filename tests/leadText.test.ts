import { describe, it, expect } from 'vitest';
import {
  renderLeadTextBody,
  provinceFromPostalCode,
  provinceTimezone,
  inDaytimeWindow,
  leadTextLang,
  pickSender,
  officeAllowed,
  classifyInboundSms,
  helpReplyBody,
} from '@/lib/leadText';

describe('lead auto-text message', () => {
  it('names the program, GWA, the 24-48h callback and the STOP opt-out', () => {
    const m = renderLeadTextBody('HD_SHEET', 'ON');
    expect(m).toContain('Home Depot Home Services');
    expect(m).toContain('Georgian Water & Air');
    expect(m).toContain('24-48');
    expect(m.toUpperCase()).toContain('STOP');
  });

  it('reads in short blocks with blank-line spacing (phone-friendly)', () => {
    expect(renderLeadTextBody('HD_SHEET', 'ON')).toContain('\n\n');
  });

  it('sends French to Quebec', () => {
    const fr = renderLeadTextBody('HD_SHEET', 'QC');
    expect(fr).toContain('Georgian Water & Air');
    expect(fr).toContain('STOP');
    expect(fr).toMatch(/evaluation de l'eau/i);
    // GSM-7 friendly: no guillemets or curly quotes that would force UCS-2.
    expect(fr).not.toMatch(/[«»“”’]/);
  });

  it('keeps the English body GSM-7 friendly (straight quotes, hyphen)', () => {
    const en = renderLeadTextBody('SCANNED', 'ON');
    expect(en).not.toMatch(/[«»“”’—]/);
  });
});

describe('follow-up message kinds', () => {
  it('day-1 reminder is branded, references the test, and carries STOP', () => {
    const m = renderLeadTextBody('SCANNED', 'ON', 'DAY1');
    expect(m).toContain('Home Depot Home Services');
    expect(m.toLowerCase()).toContain('reminder');
    expect(m.toUpperCase()).toContain('STOP');
    expect(m).not.toMatch(/[«»“”’—]/);
  });

  it('missed-window text identifies the sender and promises a call within 36 hrs', () => {
    const m = renderLeadTextBody('SCANNED', 'ON', 'MISSED_WINDOW');
    expect(m).toContain('Home Depot Home Services');
    expect(m).toContain('36 hrs');
    expect(m.toLowerCase()).toContain('sorry');
    expect(m.toUpperCase()).toContain('STOP');
    expect(m).not.toMatch(/[«»“”’—]/);
  });

  it('follow-ups localize to French for Quebec and stay GSM-7 friendly', () => {
    const d1 = renderLeadTextBody('SCANNED', 'QC', 'DAY1');
    const mw = renderLeadTextBody('SCANNED', 'QC', 'MISSED_WINDOW');
    expect(d1).toMatch(/rappel/i);
    expect(mw).toContain('36 h');
    for (const m of [d1, mw]) {
      expect(m).toContain('STOP');
      expect(m).not.toMatch(/[«»“”’—]/);
    }
  });

  it('defaults to the confirmation body when no kind is given', () => {
    expect(renderLeadTextBody('SCANNED', 'ON')).toContain('24-48');
  });

  it('includes the self-booking link on follow-ups when provided, before STOP', () => {
    const d1 = renderLeadTextBody('SCANNED', 'ON', 'DAY1', { bookingUrl: 'https://portal.ghsbarrie.ca/book/abc123' });
    expect(d1).toContain('/book/abc123');
    expect(d1.toLowerCase()).toContain('book yourself');
    expect(d1.indexOf('/book/abc123')).toBeLessThan(d1.toUpperCase().lastIndexOf('STOP'));
    expect(d1).not.toMatch(/[«»“”’—]/);
  });

  it('reactivation is a friendly "still available" nudge with STOP', () => {
    const m = renderLeadTextBody('SCANNED', 'ON', 'REACTIVATION');
    expect(m).toContain('Home Depot Home Services');
    expect(m.toLowerCase()).toContain('still available');
    expect(m.toUpperCase()).toContain('STOP');
    expect(m).not.toMatch(/[«»“”’—]/);
    expect(renderLeadTextBody('SCANNED', 'QC', 'REACTIVATION')).toMatch(/toujours disponible/i);
  });

  it('drops the booking line when no url is provided, and the confirmation has none', () => {
    expect(renderLeadTextBody('SCANNED', 'ON', 'DAY1')).not.toContain('/book/');
    expect(renderLeadTextBody('SCANNED', 'ON', 'DAY1')).not.toContain('Book yourself');
    expect(renderLeadTextBody('SCANNED', 'ON', 'CONFIRM', { bookingUrl: 'https://x/book/zzz' })).not.toContain('/book/');
  });
});

describe('personalization + fallbacks', () => {
  const INFO = 'https://portal.ghsbarrie.ca/sms';
  it('greets by first name and names the street + city', () => {
    const m = renderLeadTextBody('SCANNED', 'ON', 'CONFIRM', { firstName: 'Robyn Scott', street: '118 Scott St', city: 'Barrie', infoUrl: INFO });
    expect(m).toContain('Hi Robyn,');
    expect(m).toContain('at Scott St in Barrie');
  });
  it('falls back gracefully when name/address are missing', () => {
    const m = renderLeadTextBody('SCANNED', 'ON', 'CONFIRM', { infoUrl: INFO });
    expect(m).toContain('Hi there,');
    expect(m).not.toMatch(/Hi\s{2,},/); // never an empty "Hi ,"
    expect(m).not.toContain(' at  in ');
  });
  it('drops the house number, keeping the street name', () => {
    const m = renderLeadTextBody('SCANNED', 'ON', 'DAY1', { firstName: 'Dale', street: '12-440 Dunlop St W', city: 'Barrie' });
    expect(m).toContain('at Dunlop St W in Barrie');
    expect(m).not.toContain('440');
  });
  it('French greeting + address clause, GSM-7 friendly', () => {
    const m = renderLeadTextBody('SCANNED', 'QC', 'CONFIRM', { firstName: 'Marc', street: '5 Rue Principale', city: 'Gatineau', infoUrl: INFO });
    expect(m).toContain('Bonjour Marc,');
    expect(m).toContain('a Rue Principale, Gatineau');
    expect(m).not.toMatch(/[«»“”’—]/);
  });
});

describe('CASL program-info link (every message)', () => {
  const INFO = 'https://portal.ghsbarrie.ca/sms';

  it('includes the info link on the confirmation, after the STOP line', () => {
    const m = renderLeadTextBody('HD_SHEET', 'ON', 'CONFIRM', { infoUrl: INFO });
    expect(m).toContain(INFO);
    expect(m).toContain('Info:');
    // STOP comes before the info link (STOP is the prominent opt-out).
    expect(m.toUpperCase().indexOf('STOP')).toBeLessThan(m.indexOf(INFO));
    expect(m).not.toMatch(/[«»“”’—]/);
  });

  it('includes it on every follow-up kind too', () => {
    for (const kind of ['DAY1', 'MISSED_WINDOW', 'REACTIVATION'] as const) {
      expect(renderLeadTextBody('SCANNED', 'ON', kind, { infoUrl: INFO })).toContain(INFO);
    }
  });

  it('uses a French label in Quebec and stays GSM-7 friendly', () => {
    const m = renderLeadTextBody('HD_SHEET', 'QC', 'CONFIRM', { infoUrl: INFO });
    expect(m).toContain(INFO);
    expect(m).toContain('Infos:');
    expect(m).not.toMatch(/[«»“”’—]/);
  });

  it('drops the info line when no infoUrl is given', () => {
    const m = renderLeadTextBody('HD_SHEET', 'ON');
    expect(m).not.toContain('/sms');
    expect(m).not.toContain('Info:');
  });
});

describe('inbound keyword handling', () => {
  it('classifies STOP, START and HELP words (EN + FR)', () => {
    expect(classifyInboundSms('STOP')).toBe('stop');
    expect(classifyInboundSms('arret')).toBe('stop');
    expect(classifyInboundSms('start')).toBe('start');
    expect(classifyInboundSms('oui')).toBe('start');
    expect(classifyInboundSms('HELP')).toBe('help');
    expect(classifyInboundSms('aide')).toBe('help');
    expect(classifyInboundSms('info')).toBe('help');
    expect(classifyInboundSms('what time?')).toBe('other');
  });

  it('HELP reply identifies the sender and gives contact + opt-out, GSM-7 friendly', () => {
    const en = helpReplyBody('ON');
    expect(en).toContain('Georgian Water & Air');
    expect(en).toContain('1-866-840-2789');
    expect(en).toContain('info@georgianwaterandair.ca');
    expect(en.toUpperCase()).toContain('STOP');
    expect(en).not.toMatch(/[«»“”’—]/);
    expect(helpReplyBody('QC')).toMatch(/Aide/);
  });
});

describe('province helpers', () => {
  it('maps a postal code first letter to a province', () => {
    expect(provinceFromPostalCode('T5A 0A1')).toBe('AB');
    expect(provinceFromPostalCode('M5V 2T6')).toBe('ON');
    expect(provinceFromPostalCode('H2X 1Y4')).toBe('QC');
    expect(provinceFromPostalCode('V6B 1A1')).toBe('BC');
    expect(provinceFromPostalCode('')).toBeNull();
    expect(provinceFromPostalCode(null)).toBeNull();
  });

  it('maps provinces to timezones and defaults safely', () => {
    expect(provinceTimezone('BC')).toBe('America/Vancouver');
    expect(provinceTimezone('QC')).toBe('America/Toronto');
    expect(provinceTimezone(null)).toBe('America/Toronto');
    expect(provinceTimezone('ZZ')).toBe('America/Toronto');
  });

  it('QC is French, everything else English', () => {
    expect(leadTextLang('QC')).toBe('fr');
    expect(leadTextLang('ON')).toBe('en');
    expect(leadTextLang(null)).toBe('en');
  });
});

describe('daytime window', () => {
  it('is open midday and closed overnight in the province local time', () => {
    // 2026-01-15 17:00 UTC = 12:00 in Toronto (EST) → open; 06:00 in Toronto → closed.
    const noonET = new Date('2026-01-15T17:00:00Z');
    const earlyET = new Date('2026-01-15T11:00:00Z'); // 06:00 ET
    expect(inDaytimeWindow(noonET, 'ON', 8, 21)).toBe(true);
    expect(inDaytimeWindow(earlyET, 'ON', 8, 21)).toBe(false);
  });

  it('uses the customer province timezone, not the server', () => {
    // 2026-01-15 05:00 UTC = 21:00 (9pm) previous day in Vancouver (PST) → closed (end exclusive).
    const t = new Date('2026-01-15T05:00:00Z');
    expect(inDaytimeWindow(t, 'BC', 8, 21)).toBe(false);
  });
});

describe('sender pick', () => {
  it('prefers a province number, falls back to default, then undefined', () => {
    const map = { default: '+18668675309', ON: '+17055550123' };
    expect(pickSender('ON', map)).toBe('+17055550123');
    expect(pickSender('BC', map)).toBe('+18668675309');
    expect(pickSender('ON', {})).toBeUndefined();
  });
});

describe('office allowlist gate', () => {
  it('allows every office when the allowlist is empty', () => {
    expect(officeAllowed('d1', [])).toBe(true);
    expect(officeAllowed(null, [])).toBe(true);
    expect(officeAllowed(undefined, [])).toBe(true);
  });

  it('only allows offices on a non-empty allowlist', () => {
    const allow = ['gwa', 'd2'];
    expect(officeAllowed('gwa', allow)).toBe(true);
    expect(officeAllowed('d2', allow)).toBe(true);
    expect(officeAllowed('other', allow)).toBe(false);
  });

  it('pauses leads with no office once an allowlist is active', () => {
    expect(officeAllowed(null, ['gwa'])).toBe(false);
    expect(officeAllowed(undefined, ['gwa'])).toBe(false);
    expect(officeAllowed('', ['gwa'])).toBe(false);
  });
});

describe('inbound STOP/START classifier', () => {
  it('detects stop keywords (EN + FR) and start', () => {
    expect(classifyInboundSms('STOP')).toBe('stop');
    expect(classifyInboundSms('stop ')).toBe('stop');
    expect(classifyInboundSms('Unsubscribe')).toBe('stop');
    expect(classifyInboundSms('ARRET')).toBe('stop');
    expect(classifyInboundSms('START')).toBe('start');
    expect(classifyInboundSms('hello there')).toBe('other');
  });
});
