import { describe, it, expect } from 'vitest';
import {
  renderLeadTextBody,
  provinceFromPostalCode,
  provinceTimezone,
  inDaytimeWindow,
  leadTextLang,
  pickSender,
  classifyInboundSms,
} from '@/lib/leadText';

describe('lead auto-text message', () => {
  it('names the program, GWA, the 24-48h callback and the STOP opt-out', () => {
    const m = renderLeadTextBody('HD_SHEET', 'ON');
    expect(m).toContain('Home Depot Home Services');
    expect(m).toContain('Georgian Water & Air');
    expect(m).toContain('24-48');
    expect(m.toUpperCase()).toContain('STOP');
  });

  it('adapts the wording to the lead source', () => {
    expect(renderLeadTextBody('MAILIN', 'ON')).toContain('mail-in');
    expect(renderLeadTextBody('SCANNED', 'ON')).toContain('Home Depot store');
    expect(renderLeadTextBody('HD_SHEET', 'ON')).toContain('Home Depot water assessment request');
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
  it('day-1 reminder is branded, references the assessment, and carries STOP', () => {
    const m = renderLeadTextBody('SCANNED', 'ON', 'DAY1');
    expect(m).toContain('Georgian Water & Air');
    expect(m.toLowerCase()).toContain('reminder');
    expect(m.toUpperCase()).toContain('STOP');
    expect(m).not.toMatch(/[«»“”’—]/);
  });

  it('missed-window text promises a call again within 36 hours', () => {
    const m = renderLeadTextBody('SCANNED', 'ON', 'MISSED_WINDOW');
    expect(m).toContain('36 hours');
    expect(m.toLowerCase()).toContain('sorry');
    expect(m.toUpperCase()).toContain('STOP');
    expect(m).not.toMatch(/[«»“”’—]/);
  });

  it('follow-ups localize to French for Quebec and stay GSM-7 friendly', () => {
    const d1 = renderLeadTextBody('SCANNED', 'QC', 'DAY1');
    const mw = renderLeadTextBody('SCANNED', 'QC', 'MISSED_WINDOW');
    expect(d1).toMatch(/rappel/i);
    expect(mw).toContain('36 heures');
    for (const m of [d1, mw]) {
      expect(m).toContain('STOP');
      expect(m).not.toMatch(/[«»“”’—]/);
    }
  });

  it('defaults to the confirmation body when no kind is given', () => {
    expect(renderLeadTextBody('SCANNED', 'ON')).toContain('24-48');
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
