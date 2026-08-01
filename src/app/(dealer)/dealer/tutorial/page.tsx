import { requireDealerAccess } from '@/lib/session';

export const dynamic = 'force-dynamic';

interface Step {
  n: number;
  title: string;
  body: string[];
  img: string;
  alt: string;
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
    title: 'Resources, HD Promotions & HD Credit Card',
    body: [
      'The top menu has guides, current promotions, and step-by-step help for the Home Depot credit card.',
      'Each item shows a preview — tap View to open it in your browser, or Download to save and share it.',
    ],
    img: '/tutorial/07-hd-credit-card.png',
    alt: 'The HD Credit Card help page with preview cards.',
  },
  {
    n: 8,
    title: 'Your account',
    body: [
      'Under “My account” you can update your details, choose which email notifications you get, and turn on extra sign-in security.',
      'You can also replay the welcome tour here anytime you need a refresher.',
    ],
    img: '/tutorial/08-account.png',
    alt: 'The My account page with profile, notifications, security, and replay-tour options.',
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
            <div className="border-t border-gray-100 bg-gray-50 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.img}
                alt={s.alt}
                loading="lazy"
                className="mx-auto w-full rounded-lg border border-gray-200 bg-white shadow-sm"
              />
            </div>
          </li>
        ))}
      </ol>

      <p className="text-center text-sm text-gray-500">
        Still stuck? Use the “Chat with the Reviewer” box on any deal, and our team will help.
      </p>
    </div>
  );
}
