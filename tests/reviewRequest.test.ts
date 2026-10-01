import { describe, it, expect } from 'vitest';
import { buildReviewEmail, buildReviewSms } from '@/lib/reviewRequest';

const LINK = 'https://g.page/r/example/review';

describe('buildReviewEmail', () => {
  const email = buildReviewEmail({ customerName: 'Jane Smith', reviewLink: LINK, logoUrl: 'https://portal.example/GWANewLogo.png' });

  it('addresses the customer by first name and uses the brand name with ampersand', () => {
    expect(email.html).toContain('Hi Jane');
    expect(email.html).toContain('Georgian Water &amp; Air');
    expect(email.text).toContain('Georgian Water & Air');
  });

  it('includes the review link in both the button and the fallback, and the logo', () => {
    expect(email.html).toContain(LINK);
    expect(email.html).toContain('https://portal.example/GWANewLogo.png');
    expect(email.text).toContain(LINK);
  });

  it('has a sensible subject', () => {
    expect(email.subject).toMatch(/review|how did we do/i);
  });

  it('falls back to a neutral greeting when no name is given', () => {
    const e = buildReviewEmail({ customerName: '', reviewLink: LINK, logoUrl: 'x' });
    expect(e.html).toContain('Hi there');
  });

  it('includes the rep name and full product names when given', () => {
    const e = buildReviewEmail({
      customerName: 'Jane Smith',
      reviewLink: LINK,
      logoUrl: 'x',
      products: 'Reverse Osmosis System',
      repName: 'Mark',
    });
    expect(e.html).toContain('Home Depot Home Services');
    expect(e.html).toContain('for your new Reverse Osmosis System');
    expect(e.html).toContain('Mark and the rest of our team');
    expect(e.text).toContain('Mark and the rest of our team');
    expect(e.text).toContain('Reverse Osmosis System');
  });

  it('reads cleanly with no rep or products', () => {
    const e = buildReviewEmail({ customerName: 'Jane', reviewLink: LINK, logoUrl: 'x' });
    expect(e.html).toContain('Our team appreciates your trust');
    expect(e.html).not.toContain('for your new .');
  });
});

describe('buildReviewSms', () => {
  it('is a short message with the link and a STOP opt-out', () => {
    const sms = buildReviewSms({ customerName: 'Jane Smith', reviewLink: LINK });
    expect(sms).toContain('Jane');
    expect(sms).toContain(LINK);
    expect(sms).toMatch(/STOP/);
  });
});
