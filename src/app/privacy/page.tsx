import type { Metadata } from 'next';
import Link from 'next/link';

// Public privacy policy. DRAFT for counsel review — legally-sensitive passages are
// marked [TO CONFIRM]. Brand kit (docs/BRAND-KIT.md): "Georgian Water & Air" in
// full; web medium uses hyphenated phone numbers; greyscale.
//
// PIPEDA + provincial private-sector law (BC/AB PIPA, Québec Law 25). Not legal advice.

export const metadata: Metadata = {
  title: 'Privacy Policy — Georgian Water & Air',
  description: 'How Georgian Water & Air collects, uses, protects and shares personal information.',
  robots: { index: true, follow: true },
};

const UPDATED = '[TO CONFIRM — effective date]';

function H({ n, children }: { n: string; children: React.ReactNode }) {
  return <h2 className="mb-1.5 mt-7 text-base font-semibold text-gray-900">{n}. {children}</h2>;
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 text-gray-800">
      <header className="mb-6 border-b border-gray-200 pb-5">
        <div className="text-lg font-semibold text-gray-900">Georgian Water &amp; Air</div>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-gray-900">Privacy Policy</h1>
        <p className="mt-1 text-sm text-gray-500">Last updated: {UPDATED}</p>
      </header>

      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
        <strong>Draft for review.</strong> Passages marked <code>[TO CONFIRM]</code> should be finalized by legal
        counsel before this policy is relied upon, especially for Québec (Law&nbsp;25).
      </div>

      <div className="space-y-1 text-sm leading-relaxed">
        <p className="mt-6">
          Georgian Water &amp; Air (&ldquo;we,&rdquo; &ldquo;us,&rdquo; &ldquo;our&rdquo;) respects your privacy. This policy explains
          what personal information we collect, why, how we protect it, who we share it with, and the choices and rights you
          have. We handle personal information in accordance with Canada&rsquo;s <strong>Personal Information Protection and
          Electronic Documents Act (PIPEDA)</strong> and applicable provincial privacy laws.
        </p>

        <H n="1">Who we are</H>
        <p>
          Georgian Water &amp; Air provides in-home water-treatment assessments, sales, financing and installation,
          including as an authorized provider for Home Depot Home Services. Our <strong>Privacy Officer</strong> is your
          point of contact for any privacy question or request: <strong>[TO CONFIRM — name / title]</strong>,
          privacy@georgianwaterandair.ca <em>[TO CONFIRM]</em>, 10&nbsp;-&nbsp;11 King Street, Barrie, Ontario&nbsp; L4N&nbsp;6B5,
          1-866-840-2789.
        </p>

        <H n="2">What we collect</H>
        <ul className="list-disc space-y-1 pl-5 text-gray-700">
          <li>Contact details you give us: name, phone, email, and home address.</li>
          <li>Details of your water-assessment request and appointment.</li>
          <li>If you apply for financing: information needed to process a credit application — which may include sensitive
            information such as date of birth, Social Insurance Number, banking details (from a void cheque/PAP),
            government ID, income and proof of home ownership.</li>
          <li>Records of our communications with you (calls, texts and emails), and notes about your file.</li>
        </ul>

        <H n="3">Why we collect it</H>
        <p>We use your personal information to: schedule and provide your in-home water assessment; contact you about it;
          process, submit and fund a credit application where you apply; complete and service an installation; meet legal,
          tax and financing requirements; and improve our service. We collect only what we need for these purposes.</p>

        <H n="4">Consent</H>
        <p>By requesting an assessment or providing your information, you consent to our collecting, using and disclosing
          it for the purposes described here. For sensitive information (such as a credit application), we obtain your
          express consent at the time you apply. You may withdraw consent, subject to legal or contractual limits, by
          contacting our Privacy Officer; we will explain any consequence of doing so. <em>[TO CONFIRM — consent wording,
          especially for Québec Law&nbsp;25.]</em></p>

        <H n="5">Text messages</H>
        <p>If you asked for a free in-home water assessment, we may text you to confirm and to schedule. You can opt out at
          any time by replying <strong>STOP</strong>, and reply <strong>HELP</strong> for our contact details. See our{' '}
          <Link href="/sms" className="underline">text message program page</Link> for full details.</p>

        <H n="6">How we protect it</H>
        <p>We use safeguards appropriate to the sensitivity of the information, including encryption of the most sensitive
          fields, access controls limiting staff to what their role requires, and access logging. Our data is stored in
          <strong> Canada</strong>. No safeguard is perfect, but we work to protect your information against loss, theft
          and unauthorized access.</p>

        <H n="7">Who we share it with</H>
        <p>We share personal information only as needed to provide our service, including with: Home Depot (for the Home
          Depot Home Services program); financing companies (where you apply for financing); and service providers who act
          for us (for example, hosting, text-message and email providers) under confidentiality obligations. We <strong>do
          not sell</strong> your personal information. Some service providers may process limited data outside your
          province; <em>[TO CONFIRM — cross-border transfer disclosure for Québec Law&nbsp;25].</em> We may also disclose
          information where required by law.</p>

        <H n="8">How long we keep it</H>
        <p>We keep personal information only as long as needed for the purposes above or as required by law (for example,
          financing and tax records have minimum retention periods). When no longer needed, information is securely
          deleted or de-identified. <em>[TO CONFIRM — specific retention schedule.]</em></p>

        <H n="9">Your rights</H>
        <p>Subject to legal limits, you may ask to <strong>access</strong> the personal information we hold about you, ask
          us to <strong>correct</strong> it, or ask us to <strong>delete</strong> it. To make a request, contact our
          Privacy Officer (section&nbsp;1). We will verify your identity and respond within the time required by law. If we
          cannot delete certain records (for example, financing records we must retain), we will tell you why.</p>

        <H n="10">Changes to this policy</H>
        <p>We may update this policy from time to time. The &ldquo;last updated&rdquo; date above shows when it last
          changed.</p>

        <H n="11">Questions or concerns</H>
        <p>Contact our Privacy Officer first (section&nbsp;1). If you are not satisfied, you may contact the Office of the
          Privacy Commissioner of Canada at priv.gc.ca, or your provincial privacy regulator.</p>
      </div>

      <footer className="mt-10 border-t border-gray-100 pt-4 text-xs text-gray-400">
        Georgian Water &amp; Air · 10 - 11 King Street, Barrie, Ontario&nbsp; L4N 6B5 · 1-866-840-2789 ·
        info@georgianwaterandair.ca
      </footer>
    </main>
  );
}
