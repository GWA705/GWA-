import { requireDealerAccess } from '@/lib/session';
import { getT } from '@/i18n/server';
import type { TFunction } from '@/i18n/translator';
import { SectionHero } from '@/components/SectionHero';
import { TutorialImage } from './TutorialImage';
import { TutorialIllo } from './illustrations';

export const dynamic = 'force-dynamic';

interface Step {
  title: string;
  body: string[];
  // A real screenshot (`img`) is shown when the file exists; otherwise it falls
  // back to the line mockup (`illo`). Step numbers are assigned by position.
  illo?: string;
  img?: string;
  alt?: string;
  // Optional platform how-to lists shown instead of a visual.
  howtos?: { heading: string; steps: string[] }[];
}

function buildSteps(t: TFunction): Step[] {
  return [
    {
      title: t('tutorial.steps.s1.title'),
      body: [t('tutorial.steps.s1.body.p1'), t('tutorial.steps.s1.body.p2')],
      illo: 'login',
      img: '/tutorial/01-login.png',
      alt: 'The Georgian Water & Air dealer portal sign-in screen.',
    },
    {
      title: t('tutorial.steps.s2.title'),
      body: [t('tutorial.steps.s2.body.p1'), t('tutorial.steps.s2.body.p2'), t('tutorial.steps.s2.body.p3')],
      illo: 'nav',
      img: '/tutorial/02-navigation.png',
      alt: 'The dealer portal sidebar and top bar.',
    },
    {
      title: t('tutorial.steps.s3.title'),
      body: [t('tutorial.steps.s3.body.p1'), t('tutorial.steps.s3.body.p2'), t('tutorial.steps.s3.body.p3')],
      illo: 'dashboard',
      img: '/tutorial/03-dashboard.png',
      alt: 'The dealer home dashboard with greeting banner, KPI cards, recent applications and charts.',
    },
    {
      title: t('tutorial.steps.s4.title'),
      body: [t('tutorial.steps.s4.body.p1'), t('tutorial.steps.s4.body.p2'), t('tutorial.steps.s4.body.p3')],
      illo: 'applications',
      img: '/tutorial/04-applications.png',
      alt: 'The Applications workspace with the Tracker / Pipeline / List / Progress view switcher.',
    },
    {
      title: t('tutorial.steps.s5.title'),
      body: [t('tutorial.steps.s5.body.p1'), t('tutorial.steps.s5.body.p2'), t('tutorial.steps.s5.body.p3')],
      illo: 'newdeal',
      img: '/tutorial/05-new-customer.png',
      alt: 'The new-customer form with entry-method buttons, deal, sales and consent sections.',
    },
    {
      title: t('tutorial.steps.s6.title'),
      body: [t('tutorial.steps.s6.body.p1'), t('tutorial.steps.s6.body.p2')],
      illo: 'calculator',
      img: '/tutorial/06-payout.png',
      alt: 'The payout calculator with an approved amount, province and an estimated EFT payout.',
    },
    {
      title: t('tutorial.steps.s7.title'),
      body: [t('tutorial.steps.s7.body.p1'), t('tutorial.steps.s7.body.p2')],
      illo: 'deal',
      img: '/tutorial/07-deal.png',
      alt: 'A deal page showing the progress bar, what’s-needed card, snapshot and documents.',
    },
    {
      title: t('tutorial.steps.s8.title'),
      body: [t('tutorial.steps.s8.body.p1'), t('tutorial.steps.s8.body.p2')],
      illo: 'statusbar',
      img: '/tutorial/08-progress.png',
      alt: 'The deal progress bar with its seven stages.',
    },
    {
      title: t('tutorial.steps.s9.title'),
      body: [t('tutorial.steps.s9.body.p1'), t('tutorial.steps.s9.body.p2')],
      illo: 'upload',
      img: '/tutorial/09-upload.png',
      alt: 'The drag-and-drop upload area with a funding checklist.',
    },
    {
      title: t('tutorial.steps.s10.title'),
      body: [t('tutorial.steps.s10.body.p1'), t('tutorial.steps.s10.body.p2')],
      illo: 'chat',
      img: '/tutorial/10-chat.png',
      alt: 'The corner chat widget open with deal and general support threads.',
    },
    {
      title: t('tutorial.steps.s11.title'),
      body: [t('tutorial.steps.s11.body.p1'), t('tutorial.steps.s11.body.p2')],
      illo: 'mail',
      img: '/tutorial/11-mail.png',
      alt: 'The Mail inbox with unread markers and attachment previews.',
    },
    {
      title: t('tutorial.steps.s12.title'),
      body: [t('tutorial.steps.s12.body.p1'), t('tutorial.steps.s12.body.p2')],
      illo: 'marketplace',
      img: '/tutorial/12-marketplace.png',
      alt: 'The Marketplace with category cards, product grid and a cart panel.',
    },
    {
      title: t('tutorial.steps.s13.title'),
      body: [t('tutorial.steps.s13.body.p1'), t('tutorial.steps.s13.body.p2')],
      illo: 'giftcards',
      img: '/tutorial/13-gift-cards.png',
      alt: 'The gift-card request form with a dated sent receipt below.',
    },
    {
      title: t('tutorial.steps.s14.title'),
      body: [t('tutorial.steps.s14.body.p1'), t('tutorial.steps.s14.body.p2')],
      illo: 'leads',
      img: '/tutorial/14-leads.png',
      alt: 'The Leads list with stat tiles, search and list/grouped/map views.',
    },
    {
      title: t('tutorial.steps.s15.title'),
      body: [t('tutorial.steps.s15.body.p1'), t('tutorial.steps.s15.body.p2')],
      illo: 'reports',
      img: '/tutorial/15-reports.png',
      alt: 'The dealer reports area with monthly, weekly and (owner) product-pricing tabs.',
    },
    {
      title: t('tutorial.steps.s16.title'),
      body: [t('tutorial.steps.s16.body.p1'), t('tutorial.steps.s16.body.p2')],
      illo: 'resources',
      img: '/tutorial/16-resources.png',
      alt: 'The Resources area with preview cards and PDF thumbnails.',
    },
    {
      title: t('tutorial.steps.s17.title'),
      body: [t('tutorial.steps.s17.body.p1')],
      illo: 'account',
      img: '/tutorial/17-account.png',
      alt: 'The My account page with profile, notifications and security options.',
    },
    {
      title: t('tutorial.steps.s18.title'),
      body: [t('tutorial.steps.s18.body.p1'), t('tutorial.steps.s18.body.p2')],
      howtos: [
        {
          heading: t('tutorial.steps.s18.howtos.ios.heading'),
          steps: [
            t('tutorial.steps.s18.howtos.ios.step1'),
            t('tutorial.steps.s18.howtos.ios.step2'),
            t('tutorial.steps.s18.howtos.ios.step3'),
            t('tutorial.steps.s18.howtos.ios.step4'),
            t('tutorial.steps.s18.howtos.ios.step5'),
          ],
        },
        {
          heading: t('tutorial.steps.s18.howtos.android.heading'),
          steps: [
            t('tutorial.steps.s18.howtos.android.step1'),
            t('tutorial.steps.s18.howtos.android.step2'),
            t('tutorial.steps.s18.howtos.android.step3'),
          ],
        },
        {
          heading: t('tutorial.steps.s18.howtos.computer.heading'),
          steps: [
            t('tutorial.steps.s18.howtos.computer.step1'),
            t('tutorial.steps.s18.howtos.computer.step2'),
          ],
        },
      ],
    },
  ];
}

export default async function TutorialPage() {
  await requireDealerAccess();
  const t = getT();
  const STEPS = buildSteps(t);
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <SectionHero
        eyebrow={t('tutorial.hero.eyebrow')}
        title={t('tutorial.hero.title')}
        subtitle={t('tutorial.hero.subtitle')}
      />

      <ol className="space-y-8">
        {STEPS.map((s, idx) => (
          <li key={idx} className="card overflow-hidden">
            <div className="flex items-start gap-3 p-6 pb-4">
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
                {idx + 1}
              </span>
              <div>
                <h2 className="text-base font-semibold text-gray-900">{s.title}</h2>
                <div className="mt-2 space-y-2 text-sm leading-relaxed text-gray-700">
                  {s.body.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </div>
            </div>
            {s.howtos && (
              <div className="grid grid-cols-1 gap-4 border-t border-gray-100 bg-gray-50 p-4 sm:grid-cols-3">
                {s.howtos.map((h) => (
                  <div key={h.heading} className="rounded-lg border border-gray-200 bg-white p-4">
                    <h3 className="mb-2 text-sm font-semibold text-gray-900">{h.heading}</h3>
                    <ol className="list-decimal space-y-1 pl-4 text-xs leading-relaxed text-gray-700">
                      {h.steps.map((st, i) => (
                        <li key={i}>{st}</li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            )}
            {s.img ? (
              <TutorialImage src={s.img} alt={s.alt} illo={s.illo} />
            ) : (
              s.illo && (
                <div className="border-t border-gray-100 bg-gray-50 p-5">
                  <TutorialIllo name={s.illo} t={t} />
                </div>
              )
            )}
          </li>
        ))}
      </ol>

      <p className="text-center text-sm text-gray-500">
        {t('tutorial.footer')}
      </p>
    </div>
  );
}
