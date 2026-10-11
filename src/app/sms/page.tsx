import type { Metadata } from 'next';
import Link from 'next/link';

// Public SMS program-info + opt-out page. CASL requires each commercial message
// to identify the sender and give valid contact info; where it isn't practical to
// put the full mailing address in a text, the regs allow it to live on a readily
// accessible web page linked from the message. This is that page (linked as /sms).
//
// Brand kit (docs/BRAND-KIT.md): "Georgian Water & Air" in full; web medium uses
// hyphenated phone numbers; greyscale until the palette is confirmed.

export const metadata: Metadata = {
  title: 'Text Message Program — Home Depot Home Services (Georgian Water & Air)',
  description: 'Information and opt-out for text messages about your free in-home water assessment.',
  robots: { index: true, follow: true },
};

const UPDATED = 'October 2026';

export default function SmsInfoPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 text-gray-800">
      <header className="mb-8 border-b border-gray-200 pb-5">
        <div className="text-lg font-semibold text-gray-900">Home Depot Home Services</div>
        <div className="text-sm text-gray-500">serviced by Georgian Water &amp; Air</div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-gray-900">Text message program</h1>
        <p className="mt-1 text-sm text-gray-500">How our texts work, and how to stop them.</p>
      </header>

      <div className="space-y-7 text-sm leading-relaxed">
        <section>
          <h2 className="mb-1.5 text-base font-semibold text-gray-900">Who is texting you</h2>
          <p>
            These messages come from <strong>Georgian Water &amp; Air</strong>, the authorized provider of
            in-home water assessments for Home Depot Home Services.
          </p>
        </section>

        <section>
          <h2 className="mb-1.5 text-base font-semibold text-gray-900">Why you&rsquo;re getting them</h2>
          <p>
            You asked Home Depot for a <strong>free in-home water assessment</strong> — in store, by a
            mail-in card, or online. We text to confirm we received your request and to help schedule your
            appointment. If you didn&rsquo;t make that request, reply <strong>STOP</strong> and we&rsquo;ll
            remove your number.
          </p>
        </section>

        <section>
          <h2 className="mb-1.5 text-base font-semibold text-gray-900">What to expect</h2>
          <ul className="list-disc space-y-1 pl-5 text-gray-700">
            <li>A confirmation when your request is received.</li>
            <li>Up to a few short reminders to help us reach you to book — then we stop.</li>
            <li>Message frequency varies. <strong>Message and data rates may apply.</strong></li>
          </ul>
        </section>

        <section className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <h2 className="mb-1.5 text-base font-semibold text-gray-900">How to stop or get help</h2>
          <ul className="space-y-1 text-gray-700">
            <li>Reply <strong>STOP</strong> to any message to opt out at any time. (In French: <strong>ARRÊT</strong>.)</li>
            <li>Reply <strong>HELP</strong> for help and our contact details. (In French: <strong>AIDE</strong>.)</li>
            <li>Reply <strong>START</strong> if you opted out and want to hear from us again.</li>
          </ul>
          <p className="mt-2 text-gray-600">
            You can also contact us directly using the details below. We honour every opt-out promptly.
          </p>
        </section>

        <section>
          <h2 className="mb-1.5 text-base font-semibold text-gray-900">Contact us</h2>
          <address className="not-italic text-gray-700">
            <div className="font-medium text-gray-900">Georgian Water &amp; Air</div>
            <div>10 - 11 King Street</div>
            <div>Barrie, Ontario&nbsp; L4N 6B5</div>
            <div className="mt-2">
              Toll-Free: <a href="tel:+18668402789" className="underline">1-866-840-2789</a>
            </div>
            <div>
              Tel: <a href="tel:+17058120320" className="underline">705-812-0320</a>
            </div>
            <div>
              Email: <a href="mailto:info@georgianwaterandair.ca" className="underline">info@georgianwaterandair.ca</a>
            </div>
          </address>
        </section>

        <section>
          <h2 className="mb-1.5 text-base font-semibold text-gray-900">Your privacy</h2>
          <p className="text-gray-700">
            We use your number only to contact you about the in-home water assessment you requested. We don&rsquo;t
            sell your number. You can ask us to delete it at any time using the contact details above.
          </p>
        </section>
      </div>

      <footer className="mt-10 border-t border-gray-100 pt-4 text-xs text-gray-400">
        Last updated {UPDATED}. Home Depot Home Services, serviced by Georgian Water &amp; Air. ·{' '}
        <Link href="/privacy" className="underline">Privacy Policy</Link>
      </footer>
    </main>
  );
}
