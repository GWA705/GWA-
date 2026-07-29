import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendEmail, emailEnabled } from '@/lib/email';
import { renderEmail } from '@/lib/email-templates';

describe('email service', () => {
  const original = { ...process.env };
  beforeEach(() => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
  });
  afterEach(() => {
    process.env = { ...original };
    vi.restoreAllMocks();
  });

  it('reports disabled when SMTP is not configured', () => {
    expect(emailEnabled()).toBe(false);
  });

  it('runs in log-only mode (does not throw, does not send)', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const res = await sendEmail({ to: 'x@example.com', subject: 'Hi', html: '<p>Hello</p>' });
    expect(res.sent).toBe(false);
    expect(res.reason).toBe('log-only');
    expect(spy).toHaveBeenCalled();
  });

  it('reports enabled when SMTP env is present', () => {
    process.env.SMTP_HOST = 'smtp.gmail.com';
    process.env.SMTP_USER = 'hello@example.com';
    process.env.SMTP_PASS = 'app-password';
    expect(emailEnabled()).toBe(true);
  });
});

describe('email template', () => {
  it('renders heading, intro, and a CTA button, escaping HTML', () => {
    const html = renderEmail({
      heading: 'A <new> update',
      intro: 'You have an update.',
      ctaLabel: 'Open portal',
      ctaUrl: 'https://portal.example/deal/1',
    });
    expect(html).toContain('A &lt;new&gt; update');
    expect(html).toContain('Open portal');
    expect(html).toContain('https://portal.example/deal/1');
  });
});
