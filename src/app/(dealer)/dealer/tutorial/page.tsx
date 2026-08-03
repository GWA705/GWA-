import { requireDealerAccess } from '@/lib/session';

export const dynamic = 'force-dynamic';

interface Step {
  n: number;
  title: string;
  body: string[];
  img?: string;
  alt?: string;
  // Optional platform how-to lists shown instead of a screenshot (e.g. phone
  // notification setup, which differs by device).
  howtos?: { heading: string; steps: string[] }[];
}

const STEPS: Step[] = [
  {
    n: 1,
    title: 'Sign in',
    body: [
      'Go to portal.ghsbarrie.ca and sign in with your email and password.',
      'The first time you log in, a short welcome tour pops up automatically — you can replay it anytime from “My account.”',
    ],
    img: '/tutorial/01-login.png',
    alt: 'The GWA Dealer Portal sign-in screen.',
  },
  {
    n: 2,
    title: 'Your dashboard — all your deals',
    body: [
      'Every customer you process appears here with its current status.',
      'Search by customer name, phone number, HD #, or loan # to find anyone fast. The list shows 10 at a time — tap 25 / 50 / 100 to see more.',
      'Tap a customer’s name to open their deal, or tap “New customer processing” to start a new one.',
    ],
    img: '/tutorial/03-dashboard.png',
    alt: 'The dealer dashboard listing applications with search and paging.',
  },
  {
    n: 3,
    title: 'Process a new customer',
    body: [
      'Pick how you’re entering the deal at the top — Express (a FinanceIT approval number), Priority (type in the details), or Standard (upload documents).',
      'Fill in the customer’s details, then complete the required Sales details — salesperson, installer, SOAP included, and the product(s) sold. These feed the sales journal.',
      'Confirm consent at the bottom and tap Submit. That’s it — it lands on your dashboard and with our team for review.',
    ],
    img: '/tutorial/04-new-application.png',
    alt: 'The new-customer form with financing, deal, sales, applicant and consent sections.',
  },
  {
    n: 4,
    title: 'Open & track a deal',
    body: [
      'Tap any customer to open their deal. You’ll see the summary, review decisions, a “Chat with the Reviewer” box, and everything you’ve uploaded.',
      'Anything we share back — paperwork for your customer, or a payout receipt — shows up here too.',
    ],
    img: '/tutorial/05-deal.png',
    alt: 'A deal page showing the status bar, summary, chat and documents.',
  },
  {
    n: 5,
    title: 'Read the status bar',
    body: [
      'Across the top of every deal is a status bar that shows exactly where it is: Submitted → Approved → Docs uploaded → Confirmation → In for funding → Funded → Paid.',
      'A green check means that step is done, so at a glance you always know what’s finished and what’s next.',
    ],
    img: '/tutorial/09-status-bar.png',
    alt: 'The deal status bar with seven stages from Submitted to Paid.',
  },
  {
    n: 6,
    title: 'Upload documents (drag & drop)',
    body: [
      'To send us paperwork, drag your files straight onto the big drop area — or tap “Choose file.”',
      'You can drop several files at once (PDFs or photos). If a file lands just outside the box nothing happens — simply drop it again inside the dashed area, then tap Upload.',
    ],
    img: '/tutorial/10-upload.png',
    alt: 'The drag-and-drop document upload area on a deal.',
  },
  {
    n: 7,
    title: 'Mail from GWA',
    body: [
      'The Mail tab is where GWA sends you messages and files — bulletins, promos, and paperwork. A dot on the Mail tab means something new is waiting.',
      'Open a message to read it and see any attachments as small previews, just like your email. Tap an attachment to view it right inside the portal (there’s a “Back to message” button), or tap Download to save it.',
      'If a message asks you to confirm you’ve read it, tap “I have read this” so our team knows it reached you.',
    ],
  },
  {
    n: 8,
    title: 'Marketplace — order gear',
    body: [
      'The Marketplace tab lists items you can order — clothing, signage, and more. There are no prices and nothing to pay; it’s simply an order form.',
      'Pick a size or option where offered, set the quantity, add a note if you need to, and tap Submit order. Our team gets it and takes care of the rest.',
    ],
  },
  {
    n: 9,
    title: 'Resources, HD Promotions & HD Credit Card',
    body: [
      'The top menu has guides, current promotions, and step-by-step help for the Home Depot credit card.',
      'Each item shows a preview — tap View to open it in your browser, or Download to save and share it.',
    ],
    img: '/tutorial/07-hd-credit-card.png',
    alt: 'The HD Credit Card help page with preview cards.',
  },
  {
    n: 10,
    title: 'Your account',
    body: [
      'Under “My account” you can update your details, choose which email notifications you get, and turn on extra sign-in security.',
      'You can also replay the welcome tour here anytime you need a refresher.',
    ],
    img: '/tutorial/08-account.png',
    alt: 'The My account page with profile, notifications, security, and replay-tour options.',
  },
  {
    n: 11,
    title: 'Get notifications & pop-ups on your phone',
    body: [
      'The portal can pop up a notification on your phone or computer the moment there’s activity on a deal — even when the portal isn’t open. These come on top of the emails you already get.',
      'Turn it on under My account → “Desktop & phone notifications” → Enable. Do it once on each device where you want alerts, then use “Send a test” to confirm it’s working.',
    ],
    howtos: [
      {
        heading: '📱 iPhone / iPad (iOS 16.4 or newer)',
        steps: [
          'Open portal.ghsbarrie.ca in Safari.',
          'Tap the Share button (the square with an up-arrow) at the bottom.',
          'Tap “Add to Home Screen,” then Add.',
          'Open “GWA Portal” from the new Home Screen icon (not Safari).',
          'Go to My account → Desktop & phone notifications → Enable, and allow when asked.',
        ],
      },
      {
        heading: '🤖 Android phone',
        steps: [
          'Open portal.ghsbarrie.ca in Chrome.',
          'Go to My account → Desktop & phone notifications → Enable.',
          'Tap Allow when Chrome asks. That’s it — no install needed.',
        ],
      },
      {
        heading: '💻 Computer (Chrome, Edge or Firefox)',
        steps: [
          'Go to My account → Desktop & phone notifications → Enable.',
          'Click Allow when the browser asks. Pop-ups will appear in the corner of your screen.',
        ],
      },
    ],
  },
];

export default async function TutorialPage() {
  await requireDealerAccess();
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">How to use the portal</h1>
        <p className="mt-1 text-sm text-gray-500">
          A quick, step-by-step walkthrough of everything you’ll do here. Come back anytime.
        </p>
      </div>

      <ol className="space-y-8">
        {STEPS.map((s) => (
          <li key={s.n} className="card overflow-hidden">
            <div className="flex items-start gap-3 p-6 pb-4">
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
                {s.n}
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
            {s.img && (
              <div className="border-t border-gray-100 bg-gray-50 p-4 text-center">
                <a href={s.img} target="_blank" rel="noopener noreferrer" className="inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.img}
                    alt={s.alt}
                    loading="lazy"
                    className="mx-auto max-h-96 w-auto rounded-lg border border-gray-200 bg-white shadow-sm"
                  />
                </a>
                <p className="mt-2 text-xs text-gray-400">Tap the image to enlarge</p>
              </div>
            )}
          </li>
        ))}
      </ol>

      <p className="text-center text-sm text-gray-500">
        Still stuck? Use the “Chat with the Reviewer” box on any deal, and our team will help.
      </p>
    </div>
  );
}
